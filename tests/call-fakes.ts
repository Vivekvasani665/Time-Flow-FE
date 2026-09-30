import { vi } from "vitest";

/** A media track whose enabled flag and stop() can be inspected. */
export function fakeTrack(kind: "audio" | "video") {
  return { kind, enabled: true, readyState: "live" as MediaStreamTrackState, stop: vi.fn(function (this: { readyState: string }) { this.readyState = "ended"; }) };
}

export type FakeTrack = ReturnType<typeof fakeTrack>;

export function fakeStream(kinds: ("audio" | "video")[] = ["audio", "video"]) {
  const tracks = kinds.map(fakeTrack);
  return {
    tracks,
    stream: {
      getTracks: () => tracks,
      getAudioTracks: () => tracks.filter((t) => t.kind === "audio"),
      getVideoTracks: () => tracks.filter((t) => t.kind === "video"),
      addTrack: vi.fn(),
    } as unknown as MediaStream,
  };
}

/** Enough of RTCPeerConnection to drive PeerSession: records calls, lets tests fire its events. */
export class FakePeerConnection {
  static instances: FakePeerConnection[] = [];
  config: RTCConfiguration;
  localDescription: RTCSessionDescriptionInit | null = null;
  remoteDescription: RTCSessionDescriptionInit | null = null;
  connectionState: RTCPeerConnectionState = "new";
  iceConnectionState: RTCIceConnectionState = "new";
  addedTracks: unknown[] = [];
  addedCandidates: RTCIceCandidateInit[] = [];
  closed = false;
  onicecandidate: ((e: { candidate: RTCIceCandidate | null }) => void) | null = null;
  ontrack: ((e: { track: unknown; streams: MediaStream[] }) => void) | null = null;
  onconnectionstatechange: (() => void) | null = null;
  oniceconnectionstatechange: (() => void) | null = null;

  constructor(config: RTCConfiguration) {
    this.config = config;
    FakePeerConnection.instances.push(this);
  }

  addTrack(track: unknown) {
    this.addedTracks.push(track);
  }
  async createOffer() {
    return { type: "offer" as const, sdp: "offer-sdp" };
  }
  async createAnswer() {
    return { type: "answer" as const, sdp: "answer-sdp" };
  }
  async setLocalDescription(d: RTCSessionDescriptionInit) {
    this.localDescription = d;
  }
  async setRemoteDescription(d: RTCSessionDescriptionInit) {
    this.remoteDescription = d;
  }
  async addIceCandidate(c: RTCIceCandidateInit) {
    this.addedCandidates.push(c);
  }
  close() {
    this.closed = true;
    this.connectionState = "closed";
  }

  // ── test controls ──
  setState(state: RTCPeerConnectionState) {
    this.connectionState = state;
    this.onconnectionstatechange?.();
  }
  emitCandidate(candidate: string) {
    this.onicecandidate?.({ candidate: { candidate, sdpMid: "0", sdpMLineIndex: 0, usernameFragment: "u" } as RTCIceCandidate });
  }
  emitRemoteTrack(stream: MediaStream) {
    this.ontrack?.({ track: stream.getTracks()[0], streams: [stream] });
  }

  static latest() {
    return FakePeerConnection.instances.at(-1)!;
  }
}

type Handler = (payload: never) => void;
type Ack = { ok: true; data: unknown } | { ok: false; error: { code: string; message: string; statusCode: number } };

/**
 * The chat socket as the call code uses it: `on`/`off`, fire-and-forget `emit`,
 * and `timeout().emitWithAck()`. Tests answer acks with `respond` and push
 * server events with `serverEmit`.
 */
export class FakeSocket {
  connected = true;
  emitted: { event: string; payload: unknown }[] = [];
  /** The Manager (reconnect events), used by the chat hooks. */
  io = { on: vi.fn(), off: vi.fn() };
  private handlers = new Map<string, Set<Handler>>();
  private responders = new Map<string, (payload: unknown) => Ack>();

  on(event: string, handler: Handler) {
    (this.handlers.get(event) ?? this.handlers.set(event, new Set()).get(event)!).add(handler);
    return this;
  }
  off(event: string, handler: Handler) {
    this.handlers.get(event)?.delete(handler);
    return this;
  }
  emit(event: string, payload?: unknown) {
    this.emitted.push({ event, payload });
    return this;
  }
  timeout() {
    return {
      emitWithAck: async (event: string, payload: unknown) => {
        this.emitted.push({ event, payload });
        const respond = this.responders.get(event);
        return respond ? respond(payload) : { ok: true, data: {} };
      },
    };
  }

  // ── test controls ──
  respond(event: string, respond: (payload: never) => Ack) {
    this.responders.set(event, respond as (payload: unknown) => Ack);
  }
  serverEmit(event: string, payload: unknown) {
    for (const handler of this.handlers.get(event) ?? []) (handler as (p: unknown) => void)(payload);
  }
  sent(event: string) {
    return this.emitted.filter((e) => e.event === event).map((e) => e.payload);
  }
  listenerCount() {
    return [...this.handlers.values()].reduce((n, s) => n + s.size, 0);
  }
}
