import type { RecordingType } from "@/types/recording";
import type { RecorderErrorStatus } from "./recording-state";

/** A capture problem in words the user can act on. Raw browser errors never reach the UI. */
export class RecorderError extends Error {
  constructor(
    readonly status: RecorderErrorStatus,
    message: string,
  ) {
    super(message);
    this.name = "RecorderError";
  }
}

export type ModeInfo = {
  label: string;
  description: string;
  screen: boolean;
  camera: boolean;
};

/**
 * Only the entire display is ever recorded — never a single window or tab — so
 * a recording keeps going while the user moves between tabs and applications.
 * The user still chooses which display, in the browser's own sharing dialog.
 */
export const RECORDING_MODES: Record<RecordingType, ModeInfo> = {
  FULL_SCREEN: {
    label: "Full Screen",
    description: "Record your selected display continuously while you work across browser tabs and applications.",
    screen: true,
    camera: false,
  },
  SCREEN_WEBCAM: {
    label: "Full Screen + Webcam",
    description: "Your entire display, with your camera in a bubble on top.",
    screen: true,
    camera: true,
  },
  WEBCAM: { label: "Webcam Only", description: "Just you, on camera.", screen: false, camera: true },
};

export const MODE_ORDER: RecordingType[] = ["FULL_SCREEN", "SCREEN_WEBCAM", "WEBCAM"];

export const isRecordingType = (value: unknown): value is RecordingType => MODE_ORDER.includes(value as RecordingType);

export type BrowserSupport = {
  secureContext: boolean;
  userMedia: boolean;
  displayMedia: boolean;
  mediaRecorder: boolean;
  canvasCapture: boolean;
  webAudio: boolean;
  /** Whether sharing an entire screen can include system sound: Chromium on Windows and ChromeOS only. */
  systemAudio: boolean;
};

export function detectSupport(): BrowserSupport {
  const nav = typeof navigator === "undefined" ? undefined : navigator;
  const win = typeof window === "undefined" ? undefined : window;
  const ua = nav?.userAgent ?? "";
  const chromium = /Chrome\/|Chromium\/|Edg\//.test(ua) && !/Firefox\//.test(ua);
  return {
    secureContext: Boolean(win?.isSecureContext),
    userMedia: Boolean(nav?.mediaDevices?.getUserMedia),
    displayMedia: Boolean(nav?.mediaDevices?.getDisplayMedia),
    mediaRecorder: typeof MediaRecorder !== "undefined",
    canvasCapture: typeof HTMLCanvasElement !== "undefined" && "captureStream" in HTMLCanvasElement.prototype,
    webAudio: typeof AudioContext !== "undefined",
    systemAudio: chromium && /Windows|CrOS/.test(ua),
  };
}

/** Why a mode can't run in this browser, or null when it can. */
export function unsupportedReason(mode: RecordingType, support: BrowserSupport): string | null {
  const info = RECORDING_MODES[mode];
  if (!support.secureContext) return "Recording needs a secure connection. Open TimeFlow over https.";
  if (!support.mediaRecorder) return "This browser can't record video. Use the latest Chrome, Edge, Firefox or Safari.";
  if (info.screen && !support.displayMedia) return "This browser can't share your screen. Use Chrome, Edge or Firefox on a computer.";
  if (info.camera && !support.userMedia) return "This browser can't use a camera.";
  if (info.screen && info.camera && !support.canvasCapture) return "This browser can't combine your screen and camera. Choose Full Screen or Webcam Only instead.";
  return null;
}

/** Preferred first: WebM (VP9 → VP8) for Chromium and Firefox, MP4 for Safari. */
const MIME_CANDIDATES = [
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm;codecs=h264,opus",
  "video/webm",
  "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
  "video/mp4;codecs=avc1,mp4a",
  "video/mp4",
];

/**
 * The best recording format this browser supports, checked with
 * MediaRecorder.isTypeSupported rather than assumed. Null when none of the
 * formats the server accepts is available.
 */
export function pickMimeType(isTypeSupported: (type: string) => boolean = (t) => MediaRecorder.isTypeSupported(t)): string | null {
  for (const type of MIME_CANDIDATES) {
    try {
      if (isTypeSupported(type)) return type;
    } catch {
      /* some browsers throw for unknown codec strings */
    }
  }
  return null;
}

/** "video/webm;codecs=vp9,opus" → "video/webm": the container the server stores. */
export const containerOf = (mimeType: string) => (mimeType.split(";")[0] ?? "").trim().toLowerCase();

export const extensionFor = (mimeType: string) => (containerOf(mimeType) === "video/mp4" ? "mp4" : "webm");

const errorName = (error: unknown) => (error instanceof DOMException || error instanceof Error ? error.name : "");

/** Turns a getDisplayMedia / getUserMedia failure into something the user can act on. */
/** The user picked a window or tab in the browser's dialog instead of an entire screen. */
export const NOT_ENTIRE_SCREEN = new RecorderError(
  "SCREEN_CAPTURE_ERROR",
  "TimeFlow records your entire screen, so recording keeps going while you switch tabs and apps. In the browser's dialog, choose “Entire Screen” (not a window or tab) and try again.",
);

export function explainCaptureError(error: unknown, source: "screen" | "camera" | "microphone"): RecorderError {
  if (error instanceof RecorderError) return error;
  const name = errorName(error);
  if (source === "screen") {
    if (name === "NotAllowedError" || name === "PermissionDeniedError") {
      return new RecorderError(
        "PERMISSION_DENIED",
        "Screen sharing was cancelled or blocked. Choose “Entire Screen” in the browser's dialog — on macOS, also allow your browser under System Settings → Privacy & Security → Screen Recording.",
      );
    }
    if (name === "NotSupportedError" || name === "TypeError") return new RecorderError("BROWSER_NOT_SUPPORTED", "This browser can't share your screen. Use Chrome, Edge or Firefox on a computer.");
    return new RecorderError("SCREEN_CAPTURE_ERROR", "Your screen couldn't be captured. Try again, and choose “Entire Screen” in the browser's dialog.");
  }
  const device = source === "camera" ? "camera" : "microphone";
  const status: RecorderErrorStatus = source === "camera" ? "CAMERA_ERROR" : "MICROPHONE_ERROR";
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
    case "PermissionDeniedError":
      return new RecorderError("PERMISSION_DENIED", `${device === "camera" ? "Camera" : "Microphone"} access is blocked. Allow it from the icon in your browser's address bar, then try again.`);
    case "NotFoundError":
    case "DevicesNotFoundError":
    case "OverconstrainedError":
      return new RecorderError(status, `No ${device} was found. Connect one, pick another in the list, or turn the ${device} off.`);
    case "NotReadableError":
    case "TrackStartError":
    case "AbortError":
      return new RecorderError(status, `Your ${device} is busy. Close other apps that might be using it (video calls, other tabs) and try again.`);
    default:
      return new RecorderError(status, `Your ${device} couldn't be started. Check it's connected and try again.`);
  }
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** i;
  return `${value >= 100 || i === 0 ? Math.round(value) : value.toFixed(1)} ${units[i]}`;
}
