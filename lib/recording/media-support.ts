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
  /** Hint for the browser's picker; the user still chooses in the browser's own dialog. */
  displaySurface?: "monitor" | "window" | "browser";
};

export const RECORDING_MODES: Record<RecordingType, ModeInfo> = {
  FULL_SCREEN: { label: "Full screen", description: "Your entire display", screen: true, camera: false, displaySurface: "monitor" },
  WINDOW: { label: "Window", description: "A single app window", screen: true, camera: false, displaySurface: "window" },
  BROWSER_TAB: { label: "Browser tab", description: "One tab, with its sound", screen: true, camera: false, displaySurface: "browser" },
  SCREEN_WEBCAM: { label: "Screen + camera", description: "Screen with your face in a bubble", screen: true, camera: true, displaySurface: "monitor" },
  WEBCAM: { label: "Camera only", description: "Just you, on camera", screen: false, camera: true },
};

export const MODE_ORDER: RecordingType[] = ["FULL_SCREEN", "WINDOW", "BROWSER_TAB", "SCREEN_WEBCAM", "WEBCAM"];

export type BrowserSupport = {
  secureContext: boolean;
  userMedia: boolean;
  displayMedia: boolean;
  mediaRecorder: boolean;
  canvasCapture: boolean;
  webAudio: boolean;
  /** Best guess: the browser can share audio from a tab (Chromium) or the whole system (Chromium on Windows / ChromeOS). */
  systemAudio: "tab-and-system" | "tab-only" | "none";
};

export function detectSupport(): BrowserSupport {
  const nav = typeof navigator === "undefined" ? undefined : navigator;
  const win = typeof window === "undefined" ? undefined : window;
  const ua = nav?.userAgent ?? "";
  const chromium = /Chrome\/|Chromium\/|Edg\//.test(ua) && !/Firefox\//.test(ua);
  const windowsOrChromeOs = /Windows|CrOS/.test(ua);
  return {
    secureContext: Boolean(win?.isSecureContext),
    userMedia: Boolean(nav?.mediaDevices?.getUserMedia),
    displayMedia: Boolean(nav?.mediaDevices?.getDisplayMedia),
    mediaRecorder: typeof MediaRecorder !== "undefined",
    canvasCapture: typeof HTMLCanvasElement !== "undefined" && "captureStream" in HTMLCanvasElement.prototype,
    webAudio: typeof AudioContext !== "undefined",
    systemAudio: chromium ? (windowsOrChromeOs ? "tab-and-system" : "tab-only") : "none",
  };
}

/** Why a mode can't run in this browser, or null when it can. */
export function unsupportedReason(mode: RecordingType, support: BrowserSupport): string | null {
  const info = RECORDING_MODES[mode];
  if (!support.secureContext) return "Recording needs a secure connection. Open TimeFlow over https.";
  if (!support.mediaRecorder) return "This browser can't record video. Use the latest Chrome, Edge, Firefox or Safari.";
  if (info.screen && !support.displayMedia) return "This browser can't share your screen. Use Chrome, Edge or Firefox on a computer.";
  if (info.camera && !support.userMedia) return "This browser can't use a camera.";
  if (info.screen && info.camera && !support.canvasCapture) return "This browser can't combine your screen and camera. Record them separately instead.";
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
export function explainCaptureError(error: unknown, source: "screen" | "camera" | "microphone"): RecorderError {
  if (error instanceof RecorderError) return error;
  const name = errorName(error);
  if (source === "screen") {
    if (name === "NotAllowedError" || name === "PermissionDeniedError") {
      return new RecorderError(
        "PERMISSION_DENIED",
        "Screen sharing was cancelled or blocked. Choose a screen, window or tab in the browser's dialog — on macOS, also allow your browser under System Settings → Privacy & Security → Screen Recording.",
      );
    }
    if (name === "NotSupportedError" || name === "TypeError") return new RecorderError("BROWSER_NOT_SUPPORTED", "This browser can't share your screen. Use Chrome, Edge or Firefox on a computer.");
    return new RecorderError("SCREEN_CAPTURE_ERROR", "Your screen couldn't be captured. Try again, or pick a different window or tab.");
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
