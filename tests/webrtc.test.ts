import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CallMediaError, getLocalMedia, stopStream } from "@/lib/webrtc/media";
import { PeerSession, type PeerSessionHandlers } from "@/lib/webrtc/peer-session";
import { FakePeerConnection, fakeStream } from "./call-fakes";

const ICE = [{ urls: ["stun:stun.example.com"] }];

function session() {
  const { stream, tracks } = fakeStream();
  const handlers: PeerSessionHandlers = { onIceCandidate: vi.fn(), onRemoteStream: vi.fn(), onStateChange: vi.fn() };
  const peer = new PeerSession(ICE, stream, handlers, (config) => new FakePeerConnection(config) as unknown as RTCPeerConnection);
  return { peer, pc: FakePeerConnection.latest(), handlers, tracks };
}

beforeEach(() => {
  FakePeerConnection.instances = [];
});

describe("PeerSession", () => {
  it("sends this device's tracks and uses the given ICE servers", () => {
    const { pc, tracks } = session();
    expect(pc.config.iceServers).toEqual(ICE);
    expect(pc.addedTracks).toEqual(tracks);
  });

  it("creates the offer and sets it as the local description", async () => {
    const { peer, pc } = session();
    expect(await peer.createOffer()).toEqual({ type: "offer", sdp: "offer-sdp" });
    expect(pc.localDescription).toMatchObject({ type: "offer" });
  });

  it("answers an offer", async () => {
    const { peer, pc } = session();
    const answer = await peer.acceptOffer({ type: "offer", sdp: "remote-offer" });
    expect(pc.remoteDescription).toEqual({ type: "offer", sdp: "remote-offer" });
    expect(answer).toEqual({ type: "answer", sdp: "answer-sdp" });
    expect(pc.localDescription).toMatchObject({ type: "answer" });
  });

  it("holds ICE candidates that arrive before the remote description, then applies them", async () => {
    const { peer, pc } = session();
    const candidate = { candidate: "candidate:1 1 udp 1 10.0.0.1 5000 typ host", sdpMid: "0", sdpMLineIndex: 0 };
    await peer.addIceCandidate(candidate);
    expect(pc.addedCandidates).toEqual([]);
    await peer.createOffer();
    await peer.applyAnswer({ type: "answer", sdp: "remote-answer" });
    expect(pc.addedCandidates).toEqual([candidate]);
    const late = { ...candidate, candidate: "candidate:2" };
    await peer.addIceCandidate(late);
    expect(pc.addedCandidates).toEqual([candidate, late]);
  });

  it("reports its own ICE candidates, the remote stream and connection changes", () => {
    const { pc, handlers } = session();
    pc.emitCandidate("candidate:9");
    expect(handlers.onIceCandidate).toHaveBeenCalledWith({ candidate: "candidate:9", sdpMid: "0", sdpMLineIndex: 0, usernameFragment: "u" });
    const remote = fakeStream().stream;
    pc.emitRemoteTrack(remote);
    expect(handlers.onRemoteStream).toHaveBeenCalledWith(remote);
    pc.setState("connected");
    pc.setState("connected");
    pc.setState("failed");
    expect(vi.mocked(handlers.onStateChange).mock.calls).toEqual([["connected"], ["failed"]]);
  });

  it("mutes the microphone and turns the camera off by disabling tracks", () => {
    const { peer, tracks } = session();
    peer.setMicrophoneEnabled(false);
    peer.setCameraEnabled(false);
    expect(tracks.map((t) => t.enabled)).toEqual([false, false]);
    peer.setCameraEnabled(true);
    expect(tracks[1]!.enabled).toBe(true);
  });

  it("closes once, detaching every handler so nothing fires afterwards, and leaves the local tracks to their owner", async () => {
    const { peer, pc, handlers, tracks } = session();
    peer.close();
    peer.close();
    expect(pc.closed).toBe(true);
    expect(pc.onicecandidate).toBeNull();
    expect(pc.ontrack).toBeNull();
    expect(pc.onconnectionstatechange).toBeNull();
    await peer.addIceCandidate({ candidate: "x", sdpMid: null, sdpMLineIndex: null });
    expect(pc.addedCandidates).toEqual([]);
    expect(handlers.onStateChange).not.toHaveBeenCalled();
    expect(tracks.every((t) => t.stop.mock.calls.length === 0)).toBe(true);
    stopStream(fakeStream().stream);
  });
});

describe("getLocalMedia", () => {
  const getUserMedia = vi.fn();
  beforeEach(() => {
    vi.stubGlobal("RTCPeerConnection", FakePeerConnection);
    Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
    Object.defineProperty(navigator, "mediaDevices", { value: { getUserMedia }, configurable: true });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    getUserMedia.mockReset();
  });

  const fail = (name: string) => Object.assign(new Error(name), { name });

  it("asks for the microphone only for a voice call, and both for video", async () => {
    getUserMedia.mockResolvedValue(fakeStream().stream);
    await getLocalMedia("VOICE");
    expect(getUserMedia.mock.calls[0]![0]).toMatchObject({ video: false });
    await getLocalMedia("VIDEO");
    expect(getUserMedia.mock.calls[1]![0].video).toBeTruthy();
  });

  it("explains a blocked permission in words the user can act on", async () => {
    getUserMedia.mockRejectedValue(fail("NotAllowedError"));
    await expect(getLocalMedia("VOICE")).rejects.toMatchObject({
      code: "MEDIA_PERMISSION_DENIED",
      message: "Microphone access is blocked. Allow microphone access in your browser settings and try again.",
    });
  });

  it("joins a video call with audio only when the camera is busy or missing", async () => {
    const audio = fakeStream(["audio"]).stream;
    getUserMedia.mockRejectedValueOnce(fail("NotReadableError")).mockResolvedValueOnce(audio);
    expect(await getLocalMedia("VIDEO")).toEqual({ stream: audio, cameraUnavailable: true });
  });

  it("reports a missing microphone and a microphone in use", async () => {
    getUserMedia.mockRejectedValueOnce(fail("NotFoundError"));
    await expect(getLocalMedia("VOICE")).rejects.toMatchObject({ code: "MICROPHONE_UNAVAILABLE" });
    getUserMedia.mockRejectedValueOnce(fail("NotReadableError"));
    await expect(getLocalMedia("VOICE")).rejects.toMatchObject({ code: "DEVICE_IN_USE" });
  });

  it("refuses an unsupported browser and an insecure page", async () => {
    Object.defineProperty(navigator, "mediaDevices", { value: undefined, configurable: true });
    await expect(getLocalMedia("VOICE")).rejects.toMatchObject({ code: "BROWSER_UNSUPPORTED" });
    Object.defineProperty(window, "isSecureContext", { value: false, configurable: true });
    await expect(getLocalMedia("VOICE")).rejects.toBeInstanceOf(CallMediaError);
    await expect(getLocalMedia("VOICE")).rejects.toMatchObject({ code: "INSECURE_CONTEXT" });
  });
});
