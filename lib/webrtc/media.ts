import type { CallErrorCode, CallType } from "@/types/call";

/** A problem getting the camera or microphone, with words the user can act on. Raw browser errors never reach the UI. */
export class CallMediaError extends Error {
  constructor(
    readonly code: CallErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "CallMediaError";
  }
}

export type LocalMedia = {
  stream: MediaStream;
  /** A video call joined with audio only because the camera could not be used. */
  cameraUnavailable: boolean;
};

const AUDIO: MediaTrackConstraints = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
const VIDEO: MediaTrackConstraints = { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 }, facingMode: "user" };

function explain(error: unknown, wantsVideo: boolean): CallMediaError {
  const name = error instanceof DOMException || error instanceof Error ? error.name : "";
  const devices = wantsVideo ? "camera and microphone" : "microphone";
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
    case "PermissionDeniedError":
      return new CallMediaError(
        "MEDIA_PERMISSION_DENIED",
        wantsVideo
          ? "Camera and microphone access is blocked. Allow access in your browser settings and try again."
          : "Microphone access is blocked. Allow microphone access in your browser settings and try again.",
      );
    case "NotFoundError":
    case "DevicesNotFoundError":
    case "OverconstrainedError":
      return wantsVideo
        ? new CallMediaError("CAMERA_UNAVAILABLE", "No camera was found. Connect a camera, or start a voice call instead.")
        : new CallMediaError("MICROPHONE_UNAVAILABLE", "No microphone was found. Connect a microphone and try again.");
    case "NotReadableError":
    case "TrackStartError":
    case "AbortError":
      return new CallMediaError(
        "DEVICE_IN_USE",
        wantsVideo
          ? "Camera access is unavailable. Check that another application isn't using your camera."
          : "Your microphone is unavailable. Check that another application isn't using it.",
      );
    default:
      return new CallMediaError("CALL_FAILED", `Your ${devices} couldn't be started. Check your devices and try again.`);
  }
}

export function stopStream(stream: MediaStream | null | undefined) {
  for (const track of stream?.getTracks() ?? []) track.stop();
}

/**
 * Opens the microphone (and camera, for a video call). A video call whose
 * camera is missing or busy continues with audio only rather than failing;
 * a blocked permission or a missing microphone does fail, with a message.
 */
export async function getLocalMedia(type: CallType): Promise<LocalMedia> {
  if (typeof window !== "undefined" && !window.isSecureContext) {
    throw new CallMediaError("INSECURE_CONTEXT", "Calls need a secure connection. Open TimeFlow over https and try again.");
  }
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia || typeof RTCPeerConnection === "undefined") {
    throw new CallMediaError("BROWSER_UNSUPPORTED", "This browser doesn't support calls. Try the latest Chrome, Edge, Firefox or Safari.");
  }

  const wantsVideo = type === "VIDEO";
  try {
    return { stream: await navigator.mediaDevices.getUserMedia({ audio: AUDIO, video: wantsVideo ? VIDEO : false }), cameraUnavailable: false };
  } catch (error) {
    const problem = explain(error, wantsVideo);
    if (!wantsVideo || (problem.code !== "CAMERA_UNAVAILABLE" && problem.code !== "DEVICE_IN_USE")) throw problem;
    // The camera is the problem; the call can still go ahead with the microphone.
    try {
      return { stream: await navigator.mediaDevices.getUserMedia({ audio: AUDIO, video: false }), cameraUnavailable: true };
    } catch (audioError) {
      throw explain(audioError, false);
    }
  }
}
