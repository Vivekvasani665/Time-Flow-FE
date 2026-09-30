import type { IceCandidate, SessionDescription } from "@/types/call";

/** Connection health, simplified from RTCPeerConnection's states for the UI. */
export type PeerState = "connecting" | "connected" | "disconnected" | "failed" | "closed";

export type PeerSessionHandlers = {
  onIceCandidate: (candidate: IceCandidate) => void;
  onRemoteStream: (stream: MediaStream) => void;
  onStateChange: (state: PeerState) => void;
};

export type PeerConnectionFactory = (config: RTCConfiguration) => RTCPeerConnection;

const defaultFactory: PeerConnectionFactory = (config) => new RTCPeerConnection(config);

function toPeerState(state: RTCPeerConnectionState | RTCIceConnectionState): PeerState {
  switch (state) {
    case "connected":
    case "completed":
      return "connected";
    case "disconnected":
      return "disconnected";
    case "failed":
      return "failed";
    case "closed":
      return "closed";
    default:
      return "connecting";
  }
}

/**
 * One side of a 1-to-1 call: a single RTCPeerConnection carrying this
 * device's microphone (and camera) and the other person's. The caller makes
 * the offer, the receiver answers; ICE candidates that arrive before the
 * remote description is set are held and applied afterwards.
 *
 * Signaling is the owner's job (handlers out, methods in), which keeps this
 * free of sockets and React, and testable with a fake RTCPeerConnection.
 * It never stops the local tracks: the stream belongs to whoever opened it.
 */
export class PeerSession {
  private readonly pc: RTCPeerConnection;
  private readonly pendingCandidates: RTCIceCandidateInit[] = [];
  private remoteStream: MediaStream | null = null;
  private closed = false;
  private lastState: PeerState = "connecting";

  constructor(
    iceServers: RTCIceServer[],
    private readonly local: MediaStream,
    private readonly handlers: PeerSessionHandlers,
    factory: PeerConnectionFactory = defaultFactory,
  ) {
    this.pc = factory({ iceServers, bundlePolicy: "max-bundle", rtcpMuxPolicy: "require" });
    for (const track of local.getTracks()) this.pc.addTrack(track, local);

    this.pc.onicecandidate = (event) => {
      if (event.candidate?.candidate) {
        const c = event.candidate;
        this.handlers.onIceCandidate({ candidate: c.candidate, sdpMid: c.sdpMid, sdpMLineIndex: c.sdpMLineIndex, usernameFragment: c.usernameFragment });
      }
    };
    this.pc.ontrack = (event) => {
      const stream = event.streams[0] ?? (this.remoteStream ??= new MediaStream());
      if (!event.streams[0]) stream.addTrack(event.track);
      this.remoteStream = stream;
      this.handlers.onRemoteStream(stream);
    };
    // connectionState is the better signal; older Firefox only has iceConnectionState.
    const report = () => {
      const state = toPeerState(this.pc.connectionState ?? this.pc.iceConnectionState);
      if (state === this.lastState || this.closed) return;
      this.lastState = state;
      this.handlers.onStateChange(state);
    };
    this.pc.onconnectionstatechange = report;
    this.pc.oniceconnectionstatechange = report;
  }

  /** Caller: creates and applies the offer to send. */
  async createOffer(): Promise<SessionDescription> {
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    return { type: "offer", sdp: offer.sdp ?? "" };
  }

  /** Receiver: applies the caller's offer and returns the answer to send back. */
  async acceptOffer(offer: SessionDescription): Promise<SessionDescription> {
    await this.pc.setRemoteDescription(offer);
    await this.flushCandidates();
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    return { type: "answer", sdp: answer.sdp ?? "" };
  }

  /** Caller: applies the receiver's answer. */
  async applyAnswer(answer: SessionDescription): Promise<void> {
    await this.pc.setRemoteDescription(answer);
    await this.flushCandidates();
  }

  async addIceCandidate(candidate: IceCandidate): Promise<void> {
    if (this.closed) return;
    if (!this.pc.remoteDescription) {
      this.pendingCandidates.push(candidate);
      return;
    }
    await this.apply(candidate);
  }

  setMicrophoneEnabled(enabled: boolean) {
    for (const track of this.local.getAudioTracks()) track.enabled = enabled;
  }

  setCameraEnabled(enabled: boolean) {
    for (const track of this.local.getVideoTracks()) track.enabled = enabled;
  }

  /** Idempotent. Detaches every handler before closing, so nothing fires into a finished call. */
  close() {
    if (this.closed) return;
    this.closed = true;
    this.pendingCandidates.length = 0;
    this.pc.onicecandidate = null;
    this.pc.ontrack = null;
    this.pc.onconnectionstatechange = null;
    this.pc.oniceconnectionstatechange = null;
    this.pc.close();
    this.remoteStream = null;
  }

  private async flushCandidates() {
    for (const candidate of this.pendingCandidates.splice(0)) await this.apply(candidate);
  }

  private async apply(candidate: RTCIceCandidateInit) {
    try {
      await this.pc.addIceCandidate(candidate);
    } catch {
      // A single unusable candidate (e.g. an unsupported transport) is normal; the others still work.
    }
  }
}
