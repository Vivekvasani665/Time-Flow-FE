// Mirrors the backend's calls module (src/modules/calls/call.types.ts).
import type { ChatUser } from "./chat";

export type CallType = "VOICE" | "VIDEO";

/** Server-side status, as stored in call history. */
export type CallStatus = "RINGING" | "ACCEPTED" | "CONNECTED" | "REJECTED" | "MISSED" | "ENDED" | "FAILED";

export type CallEndReason = "hangup" | "rejected" | "cancelled" | "no_answer" | "busy" | "offline" | "failed" | "disconnected";

export type CallDto = {
  id: string;
  type: CallType;
  status: CallStatus;
  caller: ChatUser;
  receiver: ChatUser;
  startedAt: string;
  answeredAt: string | null;
  connectedAt: string | null;
  endedAt: string | null;
  durationSeconds: number | null;
};

export type CallHistoryItem = CallDto & { direction: "outgoing" | "incoming" };

export type CallContact = ChatUser & { online: boolean };

export type SessionDescription = { type: "offer" | "answer"; sdp: string };
export type IceCandidate = { candidate: string; sdpMid: string | null; sdpMLineIndex: number | null; usernameFragment?: string | null };

export type CallEndedEvent = { callId: string; status: CallStatus; reason: CallEndReason; durationSeconds: number | null };

/**
 * Where the call stands on this device. OUTGOING: getting the camera or
 * microphone and placing the call. RINGING: waiting for an answer, or ringing
 * here. ACCEPTED: answered, media being set up. CONNECTING: the peer
 * connection is negotiating. The last four are outcomes, shown briefly.
 */
export type CallPhase =
  | "IDLE"
  | "OUTGOING"
  | "RINGING"
  | "ACCEPTED"
  | "CONNECTING"
  | "CONNECTED"
  | "REJECTED"
  | "MISSED"
  | "ENDED"
  | "FAILED";

/** Error codes the call UI can show. Server codes come through the socket ack. */
export type CallErrorCode =
  | "CALL_NOT_FOUND"
  | "CALL_ALREADY_ACTIVE"
  | "CALL_BUSY"
  | "CALL_REJECTED"
  | "CALL_MISSED"
  | "CALL_FAILED"
  | "CALL_UNAUTHORIZED"
  | "CALL_SELF_CALL"
  | "CALL_RECEIVER_OFFLINE"
  | "MEDIA_PERMISSION_DENIED"
  | "CAMERA_UNAVAILABLE"
  | "MICROPHONE_UNAVAILABLE"
  | "DEVICE_IN_USE"
  | "BROWSER_UNSUPPORTED"
  | "INSECURE_CONTEXT"
  | "WEBRTC_CONNECTION_FAILED"
  | "SIGNALING_CONNECTION_FAILED";
