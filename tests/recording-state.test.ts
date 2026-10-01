import { describe, expect, it } from "vitest";
import { webcamRect } from "@/lib/recording/compositor";
import { containerOf, explainCaptureError, extensionFor, formatBytes, pickMimeType, unsupportedReason, type BrowserSupport } from "@/lib/recording/media-support";
import { hasUnsavedRecording, isCapturing, isErrorState, transition, type RecorderEvent, type RecorderState } from "@/lib/recording/recording-state";

const run = (events: RecorderEvent[], from: RecorderState = "IDLE") => events.reduce(transition, from);

describe("recorder state machine", () => {
  it("walks the happy path from idle to saved", () => {
    const states: RecorderState[] = [];
    let state: RecorderState = "IDLE";
    for (const type of ["REQUEST_PERMISSION", "PERMISSION_GRANTED", "START_COUNTDOWN", "COUNTDOWN_DONE", "PAUSE", "RESUME", "STOP", "PROCESSED", "UPLOAD", "UPLOADED"] as const) {
      state = transition(state, { type });
      states.push(state);
    }
    expect(states).toEqual(["REQUESTING_PERMISSION", "READY", "COUNTDOWN", "RECORDING", "PAUSED", "RECORDING", "PROCESSING", "PREVIEW", "UPLOADING", "SAVED"]);
  });

  it("ignores events that don't apply to the current state", () => {
    expect(transition("IDLE", { type: "STOP" })).toBe("IDLE");
    expect(transition("COUNTDOWN", { type: "PAUSE" })).toBe("COUNTDOWN");
    expect(transition("PREVIEW", { type: "PROCESSED" })).toBe("PREVIEW");
    // A late "stopped" after the user discarded must not resurrect a preview.
    expect(transition("IDLE", { type: "PROCESSED" })).toBe("IDLE");
  });

  it("allows only failures that can happen in each state", () => {
    expect(transition("REQUESTING_PERMISSION", { type: "FAIL", error: "PERMISSION_DENIED" })).toBe("PERMISSION_DENIED");
    expect(transition("RECORDING", { type: "FAIL", error: "RECORDING_FAILED" })).toBe("RECORDING_FAILED");
    expect(transition("UPLOADING", { type: "FAIL", error: "UPLOAD_FAILED" })).toBe("UPLOAD_FAILED");
    expect(transition("UPLOADING", { type: "FAIL", error: "CAMERA_ERROR" })).toBe("UPLOADING");
    expect(transition("PREVIEW", { type: "FAIL", error: "UPLOAD_FAILED" })).toBe("PREVIEW");
  });

  it("keeps the recording after an upload failure: retry or go back to the preview", () => {
    const failed = run([{ type: "UPLOAD" }, { type: "FAIL", error: "UPLOAD_FAILED" }], "PREVIEW");
    expect(failed).toBe("UPLOAD_FAILED");
    expect(hasUnsavedRecording(failed)).toBe(true);
    expect(transition(failed, { type: "UPLOAD" })).toBe("UPLOADING");
    expect(transition(failed, { type: "BACK_TO_PREVIEW" })).toBe("PREVIEW");
  });

  it("resets from anywhere and classifies states", () => {
    expect(transition("PAUSED", { type: "RESET" })).toBe("IDLE");
    expect(isErrorState("SCREEN_CAPTURE_ERROR")).toBe(true);
    expect(isErrorState("PREVIEW")).toBe(false);
    expect(isCapturing("PAUSED")).toBe(true);
    expect(isCapturing("PREVIEW")).toBe(false);
  });
});

describe("recording format detection", () => {
  it("prefers VP9 WebM, then falls back down the list", () => {
    expect(pickMimeType(() => true)).toBe("video/webm;codecs=vp9,opus");
    expect(pickMimeType((t) => t === "video/webm")).toBe("video/webm");
    // Safari: MP4 only.
    expect(pickMimeType((t) => t.startsWith("video/mp4"))).toBe("video/mp4;codecs=avc1.42E01E,mp4a.40.2");
    expect(pickMimeType(() => false)).toBeNull();
    expect(
      pickMimeType((t) => {
        if (t.includes("vp9")) throw new Error("bad codec string");
        return t.includes("vp8");
      }),
    ).toBe("video/webm;codecs=vp8,opus");
  });

  it("reduces a codec string to the stored container", () => {
    expect(containerOf("video/webm;codecs=vp9,opus")).toBe("video/webm");
    expect(extensionFor("video/mp4;codecs=avc1")).toBe("mp4");
    expect(extensionFor("video/webm")).toBe("webm");
  });
});

describe("capture errors and support", () => {
  const error = (name: string) => new DOMException("x", name);

  it("explains capture failures in actionable words", () => {
    expect(explainCaptureError(error("NotAllowedError"), "screen")).toMatchObject({ status: "PERMISSION_DENIED" });
    expect(explainCaptureError(error("AbortError"), "screen")).toMatchObject({ status: "SCREEN_CAPTURE_ERROR" });
    expect(explainCaptureError(error("NotFoundError"), "camera")).toMatchObject({ status: "CAMERA_ERROR", message: expect.stringContaining("No camera") });
    expect(explainCaptureError(error("NotReadableError"), "microphone")).toMatchObject({ status: "MICROPHONE_ERROR", message: expect.stringContaining("busy") });
    expect(explainCaptureError(error("NotAllowedError"), "microphone").status).toBe("PERMISSION_DENIED");
  });

  it("says why a mode can't run", () => {
    const full: BrowserSupport = { secureContext: true, userMedia: true, displayMedia: true, mediaRecorder: true, canvasCapture: true, webAudio: true, systemAudio: false };
    expect(unsupportedReason("SCREEN_WEBCAM", full)).toBeNull();
    expect(unsupportedReason("FULL_SCREEN", { ...full, displayMedia: false })).toMatch(/share your screen/);
    expect(unsupportedReason("WEBCAM", { ...full, displayMedia: false })).toBeNull();
    expect(unsupportedReason("SCREEN_WEBCAM", { ...full, canvasCapture: false })).toMatch(/combine/);
    expect(unsupportedReason("WEBCAM", { ...full, mediaRecorder: false })).toMatch(/can't record/);
    expect(unsupportedReason("WEBCAM", { ...full, secureContext: false })).toMatch(/https/);
  });

  it("places the webcam bubble in the chosen corner", () => {
    expect(webcamRect({ position: "bottom-right", size: "md", shape: "circle" }, 1920, 1080)).toEqual({ x: 1920 - 32 - 281, y: 1080 - 32 - 281, size: 281 });
    expect(webcamRect({ position: "top-left", size: "sm", shape: "rounded" }, 1920, 1080)).toMatchObject({ x: 32, y: 32 });
  });

  it("formats file sizes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(250 * 1024 * 1024)).toBe("250 MB");
  });
});
