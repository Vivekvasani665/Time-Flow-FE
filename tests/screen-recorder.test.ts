import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_WEBCAM_LAYOUT } from "@/lib/recording/compositor";
import { useScreenRecorder, type RecorderSettings } from "@/hooks/use-screen-recorder";

// ── Fakes for the browser media stack ─────────────────────────

class FakeTrack extends EventTarget {
  enabled = true;
  readyState: MediaStreamTrackState = "live";
  constructor(
    readonly kind: "audio" | "video",
    private readonly settings: Record<string, unknown> = {},
  ) {
    super();
  }
  stop = vi.fn(() => {
    this.readyState = "ended";
  });
  getSettings = () => this.settings;
  applyConstraints = vi.fn().mockResolvedValue(undefined);
  /** The user clicked the browser's own "Stop sharing". */
  end() {
    this.readyState = "ended";
    this.dispatchEvent(new Event("ended"));
  }
}

class FakeStream {
  constructor(readonly tracks: FakeTrack[] = []) {}
  getTracks = () => this.tracks;
  getAudioTracks = () => this.tracks.filter((t) => t.kind === "audio");
  getVideoTracks = () => this.tracks.filter((t) => t.kind === "video");
}

class FakeMediaRecorder {
  static instances: FakeMediaRecorder[] = [];
  static supported = (type: string) => type.startsWith("video/webm");
  static isTypeSupported = (type: string) => FakeMediaRecorder.supported(type);
  state: RecordingState = "inactive";
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(
    readonly stream: FakeStream,
    readonly options: MediaRecorderOptions = {},
  ) {
    FakeMediaRecorder.instances.push(this);
  }
  get mimeType() {
    return this.options.mimeType ?? "";
  }
  start = vi.fn(() => {
    this.state = "recording";
  });
  pause = vi.fn(() => {
    this.state = "paused";
  });
  resume = vi.fn(() => {
    this.state = "recording";
  });
  stop = vi.fn(() => {
    this.state = "inactive";
    queueMicrotask(() => {
      this.ondataavailable?.({ data: new Blob(["frame-data"], { type: "video/webm" }) });
      this.onstop?.();
    });
  });
}

let screen: FakeStream;
let microphone: FakeStream;
let camera: FakeStream;
const getDisplayMedia = vi.fn();
const getUserMedia = vi.fn();
const fetchSpy = vi.fn();
const xhrOpen = vi.fn();

const settings = (overrides: Partial<RecorderSettings> = {}): RecorderSettings => ({
  mode: "FULL_SCREEN",
  microphone: true,
  systemAudio: false,
  cameraId: null,
  microphoneId: null,
  webcam: DEFAULT_WEBCAM_LAYOUT,
  ...overrides,
});

beforeEach(() => {
  vi.useFakeTimers();
  FakeMediaRecorder.instances = [];
  FakeMediaRecorder.supported = (type) => type.startsWith("video/webm");
  screen = new FakeStream([new FakeTrack("video", { displaySurface: "window", width: 1920, height: 1080 })]);
  microphone = new FakeStream([new FakeTrack("audio")]);
  camera = new FakeStream([new FakeTrack("video", { width: 1280, height: 720 })]);
  getDisplayMedia.mockReset().mockImplementation(async () => screen);
  getUserMedia.mockReset().mockImplementation(async (c: MediaStreamConstraints) => (c.video ? camera : microphone));
  vi.stubGlobal("MediaRecorder", FakeMediaRecorder);
  vi.stubGlobal("MediaStream", FakeStream);
  vi.stubGlobal("fetch", fetchSpy);
  vi.stubGlobal("XMLHttpRequest", class { open = xhrOpen; send = vi.fn(); setRequestHeader = vi.fn(); upload = {}; });
  Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
  Object.defineProperty(navigator, "mediaDevices", { value: { getDisplayMedia, getUserMedia }, configurable: true });
  URL.createObjectURL = vi.fn(() => "blob:recording-1");
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function startAndCountDown(result: { current: ReturnType<typeof useScreenRecorder> }, s = settings()) {
  await act(async () => {
    await result.current.start(s);
  });
  expect(result.current.status).toBe("COUNTDOWN");
  expect(result.current.countdown).toBe(3);
  await act(async () => {
    vi.advanceTimersByTime(3000);
  });
}

describe("useScreenRecorder", () => {
  it("records the screen with the microphone, entirely locally, and opens a preview on stop", async () => {
    const { result } = renderHook(() => useScreenRecorder());
    await startAndCountDown(result);

    expect(getDisplayMedia).toHaveBeenCalledWith(expect.objectContaining({ video: expect.objectContaining({ displaySurface: "monitor" }), audio: false }));
    expect(result.current.status).toBe("RECORDING");
    // The browser's picker chose a window: the recording says so.
    expect(result.current.recordingType).toBe("WINDOW");
    const recorder = FakeMediaRecorder.instances[0]!;
    expect(recorder.options.mimeType).toBe("video/webm;codecs=vp9,opus");
    expect(recorder.stream.getVideoTracks()).toEqual(screen.getVideoTracks());
    expect(recorder.stream.getAudioTracks()).toEqual(microphone.getAudioTracks());
    expect(recorder.start).toHaveBeenCalledWith(1000);

    act(() => result.current.pause());
    expect(result.current.status).toBe("PAUSED");
    expect(recorder.pause).toHaveBeenCalled();
    act(() => result.current.resume());
    expect(result.current.status).toBe("RECORDING");

    act(() => result.current.toggleMic());
    expect(microphone.tracks[0]!.enabled).toBe(false);
    expect(result.current.micOn).toBe(false);

    await act(async () => {
      result.current.stop();
      await Promise.resolve();
    });
    expect(result.current.status).toBe("PREVIEW");
    expect(result.current.result).toMatchObject({ url: "blob:recording-1", mimeType: "video/webm", recordingType: "WINDOW" });
    expect(result.current.getBlob()?.type).toBe("video/webm");
    // Every track is stopped once recording ends.
    for (const track of [...screen.tracks, ...microphone.tracks]) expect(track.stop).toHaveBeenCalled();
    // Nothing went over the network while recording.
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(xhrOpen).not.toHaveBeenCalled();

    act(() => result.current.discard());
    expect(result.current.status).toBe("IDLE");
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:recording-1");
    expect(result.current.getBlob()).toBeNull();
  });

  it("stops when the user ends sharing from the browser's own controls", async () => {
    const { result } = renderHook(() => useScreenRecorder());
    await startAndCountDown(result);
    await act(async () => {
      screen.tracks[0]!.end();
      await Promise.resolve();
    });
    expect(result.current.status).toBe("PREVIEW");
  });

  it("records the camera alone in webcam mode", async () => {
    const { result } = renderHook(() => useScreenRecorder());
    await startAndCountDown(result, settings({ mode: "WEBCAM", microphone: false, cameraId: "cam-2" }));
    expect(getDisplayMedia).not.toHaveBeenCalled();
    expect(getUserMedia).toHaveBeenCalledWith({ video: expect.objectContaining({ deviceId: { exact: "cam-2" } }) });
    expect(result.current.cameraStream).toBe(camera);
    expect(FakeMediaRecorder.instances[0]!.stream.getTracks()).toEqual(camera.getVideoTracks());
    act(() => result.current.toggleCamera());
    expect(camera.tracks[0]!.enabled).toBe(false);
  });

  it("reports a cancelled screen picker as permission denied and releases everything", async () => {
    getDisplayMedia.mockRejectedValueOnce(new DOMException("denied", "NotAllowedError"));
    const { result } = renderHook(() => useScreenRecorder());
    await act(async () => {
      await result.current.start(settings());
    });
    expect(result.current.status).toBe("PERMISSION_DENIED");
    expect(result.current.error).toMatch(/Screen sharing was cancelled/);
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it("stops the shared screen when the microphone then fails", async () => {
    getUserMedia.mockRejectedValueOnce(new DOMException("busy", "NotReadableError"));
    const { result } = renderHook(() => useScreenRecorder());
    await act(async () => {
      await result.current.start(settings());
    });
    expect(result.current.status).toBe("MICROPHONE_ERROR");
    expect(screen.tracks[0]!.stop).toHaveBeenCalled();
  });

  it("refuses to start when the browser supports no format the server accepts", async () => {
    FakeMediaRecorder.supported = () => false;
    const { result } = renderHook(() => useScreenRecorder());
    await act(async () => {
      await result.current.start(settings());
    });
    expect(result.current.status).toBe("BROWSER_NOT_SUPPORTED");
    expect(getDisplayMedia).not.toHaveBeenCalled();
  });

  it("cancelling the countdown releases the capture without recording", async () => {
    const { result } = renderHook(() => useScreenRecorder());
    await act(async () => {
      await result.current.start(settings());
    });
    act(() => result.current.discard());
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    expect(result.current.status).toBe("IDLE");
    expect(FakeMediaRecorder.instances).toHaveLength(0);
    expect(screen.tracks[0]!.stop).toHaveBeenCalled();
  });

  it("tracks the upload lifecycle without losing the recording on failure", async () => {
    const { result } = renderHook(() => useScreenRecorder());
    await startAndCountDown(result);
    await act(async () => {
      result.current.stop();
      await Promise.resolve();
    });
    act(() => void result.current.markUploading());
    expect(result.current.status).toBe("UPLOADING");
    act(() => void result.current.markUploadFailed("Network down."));
    expect(result.current.status).toBe("UPLOAD_FAILED");
    expect(result.current.error).toBe("Network down.");
    expect(result.current.getBlob()).not.toBeNull();
    act(() => void result.current.markUploading());
    act(() => void result.current.markSaved());
    expect(result.current.status).toBe("SAVED");
  });
});
