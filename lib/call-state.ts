import type { CallEndReason, CallErrorCode, CallPhase, CallStatus, CallType } from "@/types/call";
import type { ChatUser } from "@/types/chat";

/** The call on this device (there is never more than one). */
export type CallSession = {
  phase: CallPhase;
  /** Known once the server has registered the call. */
  callId: string | null;
  type: CallType;
  direction: "outgoing" | "incoming";
  peer: ChatUser;
  /** When media started flowing (ms since epoch); the timer counts from here. */
  connectedAt: number | null;
  muted: boolean;
  cameraOff: boolean;
  /** Video call joined without a camera. */
  cameraUnavailable: boolean;
  /** The media connection dropped and is trying to recover. */
  reconnecting: boolean;
  /** Final outcome in words ("Priya declined the call."), shown with a terminal phase. */
  message: string | null;
  error: CallErrorCode | null;
  durationSeconds: number | null;
};

export type CallAction =
  | { type: "dial"; peer: ChatUser; callType: CallType }
  | { type: "placed"; callId: string }
  | { type: "incoming"; callId: string; peer: ChatUser; callType: CallType }
  | { type: "answering"; callId: string }
  | { type: "accepted"; callId: string }
  | { type: "connecting"; callId: string }
  | { type: "connected"; callId: string; at: number }
  | { type: "media"; cameraUnavailable: boolean }
  | { type: "reconnecting"; callId: string; reconnecting: boolean }
  | { type: "toggle-mute" }
  | { type: "toggle-camera" }
  | { type: "finish"; callId: string | null; phase: TerminalPhase; message: string | null; error?: CallErrorCode | null; durationSeconds?: number | null }
  | { type: "dismiss"; callId?: string | null }
  | { type: "reset" };

export type TerminalPhase = Extract<CallPhase, "REJECTED" | "MISSED" | "ENDED" | "FAILED">;

const TERMINAL: readonly CallPhase[] = ["REJECTED", "MISSED", "ENDED", "FAILED"];

export const isTerminal = (phase: CallPhase) => TERMINAL.includes(phase);
/** A call that is ringing, being set up, or in progress. */
export const isLive = (session: CallSession | null): session is CallSession => session !== null && !isTerminal(session.phase);

/** Events carry a call id; one for another (older, duplicate) call must not touch this one. */
const sameCall = (session: CallSession | null, callId: string | null | undefined): session is CallSession =>
  session !== null && callId != null && session.callId === callId;

function fresh(peer: ChatUser, type: CallType, direction: CallSession["direction"], phase: CallPhase, callId: string | null): CallSession {
  return {
    phase,
    callId,
    type,
    direction,
    peer,
    connectedAt: null,
    muted: false,
    cameraOff: false,
    cameraUnavailable: false,
    reconnecting: false,
    message: null,
    error: null,
    durationSeconds: null,
  };
}

/**
 * The call state machine. Every transition names the call it is for, so a
 * late or repeated socket event (a second "accepted", an "ended" for the
 * previous call) is ignored instead of corrupting the current call.
 */
export function callReducer(state: CallSession | null, action: CallAction): CallSession | null {
  switch (action.type) {
    case "dial":
      // Never replace a call in progress; the UI doesn't offer this, but a double click might.
      return isLive(state) ? state : fresh(action.peer, action.callType, "outgoing", "OUTGOING", null);
    case "placed":
      return state?.phase === "OUTGOING" && state.callId === null ? { ...state, callId: action.callId, phase: "RINGING" } : state;
    case "incoming":
      return isLive(state) ? state : fresh(action.peer, action.callType, "incoming", "RINGING", action.callId);
    case "answering":
      return sameCall(state, action.callId) && state.phase === "RINGING" && state.direction === "incoming" ? { ...state, phase: "ACCEPTED" } : state;
    case "accepted":
      return sameCall(state, action.callId) && (state.phase === "RINGING" || state.phase === "ACCEPTED") ? { ...state, phase: "ACCEPTED" } : state;
    case "connecting":
      return sameCall(state, action.callId) && state.phase === "ACCEPTED" ? { ...state, phase: "CONNECTING" } : state;
    case "connected":
      if (!sameCall(state, action.callId) || isTerminal(state.phase)) return state;
      return { ...state, phase: "CONNECTED", connectedAt: state.connectedAt ?? action.at, reconnecting: false };
    case "media":
      return state ? { ...state, cameraUnavailable: action.cameraUnavailable, cameraOff: action.cameraUnavailable || state.cameraOff } : state;
    case "reconnecting":
      return sameCall(state, action.callId) && !isTerminal(state.phase) ? { ...state, reconnecting: action.reconnecting } : state;
    case "toggle-mute":
      return isLive(state) ? { ...state, muted: !state.muted } : state;
    case "toggle-camera":
      return isLive(state) && state.type === "VIDEO" && !state.cameraUnavailable ? { ...state, cameraOff: !state.cameraOff } : state;
    case "finish":
      // Before the server knows the call (callId null), only the call being placed can finish.
      if (!state || isTerminal(state.phase)) return state;
      if (action.callId !== null && state.callId !== null && action.callId !== state.callId) return state;
      return {
        ...state,
        phase: action.phase,
        reconnecting: false,
        message: action.message,
        error: action.error ?? null,
        durationSeconds: action.durationSeconds ?? state.durationSeconds,
      };
    case "dismiss":
      return action.callId === undefined || state?.callId === action.callId ? null : state;
    case "reset":
      return null;
  }
}

/** The server's final status as a phase on this device. */
export function phaseForStatus(status: CallStatus): TerminalPhase {
  if (status === "REJECTED" || status === "MISSED" || status === "FAILED") return status;
  return "ENDED";
}

/** What the person on this device reads when a call finishes. */
export function outcomeMessage(reason: CallEndReason, session: Pick<CallSession, "direction" | "peer">): string | null {
  const name = session.peer.firstName;
  const outgoing = session.direction === "outgoing";
  switch (reason) {
    case "rejected":
      return outgoing ? `${name} declined the call.` : "Call declined.";
    case "no_answer":
      return outgoing ? `${name} didn't answer.` : "Missed call.";
    case "cancelled":
      return outgoing ? "Call cancelled." : null;
    case "busy":
      return "This user is currently on another call.";
    case "offline":
      return `${name} isn't online right now.`;
    case "failed":
      return "Unable to connect the call. Check your internet connection and try again.";
    case "disconnected":
      return "The call was disconnected.";
    case "hangup":
      return "Call ended.";
  }
}

/** "4 min 32 sec", "12 sec", "1 hr 3 min". */
export function formatCallDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  if (hours) return `${hours} hr ${minutes} min`;
  if (minutes) return `${minutes} min ${seconds} sec`;
  return `${seconds} sec`;
}

/** "04:32", "1:02:05" — the running timer. */
export function formatTimer(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hh = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return hh ? `${hh}:${mm}:${ss}` : `${mm}:${ss}`;
}
