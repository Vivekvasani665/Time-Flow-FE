/**
 * The recorder's lifecycle as an explicit state machine. Every change goes
 * through `transition`, which refuses moves the lifecycle doesn't allow (a
 * late "stopped" after a discard, a second "start" while counting down), so
 * async browser callbacks arriving out of order can't corrupt the UI.
 *
 *   IDLE → REQUESTING_PERMISSION → READY → COUNTDOWN → RECORDING ⇄ PAUSED
 *        → PROCESSING → PREVIEW → UPLOADING → SAVED
 *
 * Any step can fail into one of the error states; from there the user can
 * retry (back to IDLE) — or, after an upload failure, return to PREVIEW with
 * the recording still intact.
 */

export type RecorderStatus =
  | "IDLE"
  | "REQUESTING_PERMISSION"
  | "READY"
  | "COUNTDOWN"
  | "RECORDING"
  | "PAUSED"
  | "PROCESSING"
  | "PREVIEW"
  | "UPLOADING"
  | "SAVED";

export type RecorderErrorStatus =
  | "PERMISSION_DENIED"
  | "CAMERA_ERROR"
  | "MICROPHONE_ERROR"
  | "SCREEN_CAPTURE_ERROR"
  | "BROWSER_NOT_SUPPORTED"
  | "RECORDING_FAILED"
  | "UPLOAD_FAILED";

export type RecorderState = RecorderStatus | RecorderErrorStatus;

export type RecorderEvent =
  | { type: "REQUEST_PERMISSION" }
  | { type: "PERMISSION_GRANTED" }
  | { type: "START_COUNTDOWN" }
  | { type: "COUNTDOWN_DONE" }
  | { type: "PAUSE" }
  | { type: "RESUME" }
  | { type: "STOP" }
  | { type: "PROCESSED" }
  | { type: "UPLOAD" }
  | { type: "UPLOADED" }
  | { type: "FAIL"; error: RecorderErrorStatus }
  | { type: "BACK_TO_PREVIEW" }
  | { type: "RESET" };

export const ERROR_STATES: readonly RecorderErrorStatus[] = [
  "PERMISSION_DENIED",
  "CAMERA_ERROR",
  "MICROPHONE_ERROR",
  "SCREEN_CAPTURE_ERROR",
  "BROWSER_NOT_SUPPORTED",
  "RECORDING_FAILED",
  "UPLOAD_FAILED",
];

export const isErrorState = (state: RecorderState): state is RecorderErrorStatus => (ERROR_STATES as readonly string[]).includes(state);

/** Media is live (camera light on / screen being shared). */
export const isCapturing = (state: RecorderState) => state === "READY" || state === "COUNTDOWN" || state === "RECORDING" || state === "PAUSED";

/** A finished recording exists that has not been saved; leaving would lose it. */
export const hasUnsavedRecording = (state: RecorderState) => state === "PREVIEW" || state === "UPLOADING" || state === "UPLOAD_FAILED";

/** Which events each state accepts, and where they lead. FAIL and RESET are handled separately. */
const TABLE: Partial<Record<RecorderState, Partial<Record<RecorderEvent["type"], RecorderState>>>> = {
  IDLE: { REQUEST_PERMISSION: "REQUESTING_PERMISSION" },
  REQUESTING_PERMISSION: { PERMISSION_GRANTED: "READY" },
  READY: { START_COUNTDOWN: "COUNTDOWN" },
  COUNTDOWN: { COUNTDOWN_DONE: "RECORDING" },
  RECORDING: { PAUSE: "PAUSED", STOP: "PROCESSING" },
  PAUSED: { RESUME: "RECORDING", STOP: "PROCESSING" },
  PROCESSING: { PROCESSED: "PREVIEW" },
  PREVIEW: { UPLOAD: "UPLOADING" },
  UPLOADING: { UPLOADED: "SAVED" },
  UPLOAD_FAILED: { BACK_TO_PREVIEW: "PREVIEW", UPLOAD: "UPLOADING" },
};

/** Which failures are possible from where: a camera error can't happen mid-upload, and vice versa. */
const FAILURES: Partial<Record<RecorderState, readonly RecorderErrorStatus[]>> = {
  IDLE: ["BROWSER_NOT_SUPPORTED"],
  REQUESTING_PERMISSION: ["PERMISSION_DENIED", "CAMERA_ERROR", "MICROPHONE_ERROR", "SCREEN_CAPTURE_ERROR", "BROWSER_NOT_SUPPORTED", "RECORDING_FAILED"],
  READY: ["RECORDING_FAILED", "SCREEN_CAPTURE_ERROR", "CAMERA_ERROR"],
  COUNTDOWN: ["RECORDING_FAILED", "SCREEN_CAPTURE_ERROR", "CAMERA_ERROR", "BROWSER_NOT_SUPPORTED"],
  RECORDING: ["RECORDING_FAILED"],
  PAUSED: ["RECORDING_FAILED"],
  PROCESSING: ["RECORDING_FAILED"],
  UPLOADING: ["UPLOAD_FAILED"],
};

/** The next state, or the same state when the event doesn't apply. */
export function transition(state: RecorderState, event: RecorderEvent): RecorderState {
  if (event.type === "RESET") return "IDLE";
  if (event.type === "FAIL") return FAILURES[state]?.includes(event.error) ? event.error : state;
  return TABLE[state]?.[event.type] ?? state;
}
