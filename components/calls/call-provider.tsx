"use client";

import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import type { Socket } from "socket.io-client";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/auth-provider";
import { useChatSocket } from "@/hooks/use-chat-socket";
import { callReducer, isLive, isTerminal, outcomeMessage, phaseForStatus, type CallSession, type TerminalPhase } from "@/lib/call-state";
import { queryKeys } from "@/lib/query-keys";
import { resolveIceServers } from "@/lib/webrtc/ice-servers";
import { CallMediaError, getLocalMedia, stopStream } from "@/lib/webrtc/media";
import { PeerSession, type PeerState } from "@/lib/webrtc/peer-session";
import { playIncomingRingtone, playRingback, stopRingtone } from "@/lib/webrtc/ringtone";
import type { CallDto, CallEndedEvent, CallErrorCode, CallType, IceCandidate, SessionDescription } from "@/types/call";
import type { ChatAck, ChatUser } from "@/types/chat";
import { CallOverlay } from "./call-overlay";

/** How long a dropped media connection may try to recover before the call ends. */
const RECONNECT_WINDOW_MS = 15_000;
/** How long an outcome ("Priya declined the call.") stays on screen. */
const OUTCOME_MS = 4_000;
const ACK_TIMEOUT_MS = 10_000;

const OFFLINE_MESSAGE = "You're not connected to TimeFlow right now. Check your internet connection and try again.";
const FAILED_MESSAGE = "Unable to connect the call. Check your internet connection and try again.";

class CallRequestError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export type CallContextValue = {
  /** False outside the signed-in app (and in isolated component tests): call buttons hide. */
  available: boolean;
  session: CallSession | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  /** What the other person told us about their microphone and camera. */
  remoteMedia: RemoteMedia;
  startCall: (peer: ChatUser, type: CallType) => void;
  accept: () => void;
  reject: () => void;
  end: () => void;
  toggleMute: () => void;
  toggleCamera: () => void;
  /** Closes an outcome screen. */
  dismiss: () => void;
};

export type RemoteMedia = { muted: boolean; cameraOff: boolean };
const REMOTE_DEFAULT: RemoteMedia = { muted: false, cameraOff: false };

const noop = () => undefined;
const UNAVAILABLE: CallContextValue = {
  available: false,
  session: null,
  localStream: null,
  remoteStream: null,
  remoteMedia: REMOTE_DEFAULT,
  startCall: noop,
  accept: noop,
  reject: noop,
  end: noop,
  toggleMute: noop,
  toggleCamera: noop,
  dismiss: noop,
};

const CallContext = createContext<CallContextValue>(UNAVAILABLE);

export const useCall = () => useContext(CallContext);

/**
 * 1-to-1 voice and video calls, for the whole signed-in app: an incoming call
 * rings on any page. Signaling goes over the shared chat socket; audio and
 * video go peer to peer through WebRTC (see lib/webrtc). This component owns
 * the call's resources — local media, the peer connection, timers — and
 * releases every one of them whenever the call ends, however it ends.
 */
export function CallProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { socket } = useChatSocket(Boolean(user));
  const queryClient = useQueryClient();

  const [session, dispatch] = useReducer(callReducer, null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [remoteMedia, setRemoteMedia] = useState<RemoteMedia>(REMOTE_DEFAULT);

  // Socket handlers and async steps read the latest values from refs, not stale closures.
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const socketRef = useRef<Socket | null>(socket);
  socketRef.current = socket;
  /** The call this device is in (or ringing for); set synchronously, before React re-renders. */
  const callIdRef = useRef<string | null>(null);
  const peerRef = useRef<PeerSession | null>(null);
  const localRef = useRef<MediaStream | null>(null);
  const iceRef = useRef<Promise<RTCIceServer[]> | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  /** Bumped when a call being placed is abandoned, so its in-flight steps stop. */
  const dialToken = useRef(0);

  const request = useCallback(async <T,>(event: string, payload: unknown): Promise<T> => {
    const s = socketRef.current;
    if (!s?.connected) throw new CallRequestError("SIGNALING_CONNECTION_FAILED", OFFLINE_MESSAGE);
    let res: ChatAck<T>;
    try {
      res = (await s.timeout(ACK_TIMEOUT_MS).emitWithAck(event, payload)) as ChatAck<T>;
    } catch {
      throw new CallRequestError("SIGNALING_CONNECTION_FAILED", OFFLINE_MESSAGE);
    }
    if (!res.ok) throw new CallRequestError(res.error.code, res.error.message);
    return res.data;
  }, []);

  /** Releases everything the call holds. Safe to call any number of times. */
  const teardown = useCallback(() => {
    clearTimeout(reconnectTimer.current);
    stopRingtone();
    peerRef.current?.close();
    peerRef.current = null;
    stopStream(localRef.current);
    localRef.current = null;
    iceRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    setRemoteMedia(REMOTE_DEFAULT);
  }, []);

  /** Lets the other side show "muted" / "camera off" instead of silence or a black tile. */
  const shareMediaState = useCallback((muted: boolean, cameraOff: boolean) => {
    const callId = callIdRef.current;
    if (callId && peerRef.current) socketRef.current?.emit("call:media-state", { callId, state: { muted, cameraOff } });
  }, []);

  const refreshHistory = useCallback(
    (peerId: string | undefined) => {
      if (peerId) void queryClient.invalidateQueries({ queryKey: queryKeys.calls.history(peerId) });
    },
    [queryClient],
  );

  const finish = useCallback(
    (callId: string | null, phase: TerminalPhase, message: string | null, error: CallErrorCode | null = null, durationSeconds?: number | null) => {
      teardown();
      callIdRef.current = null;
      dispatch({ type: "finish", callId, phase, message, error, durationSeconds });
      refreshHistory(sessionRef.current?.peer.id);
    },
    [teardown, refreshHistory],
  );

  const fail = useCallback(
    (callId: string) => {
      socketRef.current?.emit("call:end", { callId, reason: "failed" });
      finish(callId, "FAILED", FAILED_MESSAGE, "WEBRTC_CONNECTION_FAILED");
    },
    [finish],
  );

  const onPeerState = useCallback(
    (callId: string, state: PeerState) => {
      if (callIdRef.current !== callId) return;
      if (state === "connected") {
        clearTimeout(reconnectTimer.current);
        dispatch({ type: "connected", callId, at: Date.now() });
        socketRef.current?.emit("call:connected", { callId });
        const s = sessionRef.current;
        if (s && (s.muted || s.cameraOff)) shareMediaState(s.muted, s.cameraOff);
      } else if (state === "disconnected") {
        // Often a brief network change; give it a moment to recover on its own.
        dispatch({ type: "reconnecting", callId, reconnecting: true });
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = setTimeout(() => fail(callId), RECONNECT_WINDOW_MS);
      } else if (state === "failed") {
        fail(callId);
      }
    },
    [fail, shareMediaState],
  );

  const createPeer = useCallback(
    (callId: string, stream: MediaStream, iceServers: RTCIceServer[]) => {
      peerRef.current?.close();
      const peer = new PeerSession(iceServers, stream, {
        onIceCandidate: (candidate) => socketRef.current?.emit("call:ice-candidate", { callId, candidate }),
        onRemoteStream: setRemoteStream,
        onStateChange: (state) => onPeerState(callId, state),
      });
      peerRef.current = peer;
      return peer;
    },
    [onPeerState],
  );

  const openMedia = useCallback(async (type: CallType) => {
    const media = await getLocalMedia(type);
    localRef.current = media.stream;
    setLocalStream(media.stream);
    dispatch({ type: "media", cameraUnavailable: media.cameraUnavailable });
    if (media.cameraUnavailable) toast("Your camera isn't available", { description: "You're joining with audio only." });
    return media.stream;
  }, []);

  // ── Placing a call ────────────────────────────────────────
  const startCall = useCallback(
    (peer: ChatUser, type: CallType) => {
      if (isLive(sessionRef.current)) {
        toast("You're already on a call", { description: "End it before starting another." });
        return;
      }
      const token = ++dialToken.current;
      const abandoned = () => dialToken.current !== token;
      dispatch({ type: "dial", peer, callType: type });

      void (async () => {
        let stream: MediaStream;
        try {
          stream = await openMedia(type);
        } catch (error) {
          if (abandoned()) return;
          const e = error instanceof CallMediaError ? error : new CallMediaError("CALL_FAILED", FAILED_MESSAGE);
          finish(null, "FAILED", e.message, e.code);
          return;
        }
        if (abandoned()) return stopStream(stream);
        iceRef.current = resolveIceServers();

        let call: CallDto;
        try {
          call = await request<CallDto>("call:initiate", { receiverId: peer.id, type });
        } catch (error) {
          if (abandoned()) return;
          const e = error instanceof CallRequestError ? error : new CallRequestError("CALL_FAILED", FAILED_MESSAGE);
          const expected = e.code === "CALL_BUSY" || e.code === "CALL_RECEIVER_OFFLINE";
          finish(null, expected ? "MISSED" : "FAILED", e.message, e.code as CallErrorCode);
          return;
        }
        if (abandoned()) {
          // Hung up while the call was being placed: cancel it on the server too.
          socketRef.current?.emit("call:end", { callId: call.id });
          return;
        }
        callIdRef.current = call.id;
        dispatch({ type: "placed", callId: call.id });
        playRingback();
      })();
    },
    [openMedia, request, finish],
  );

  // ── Answering ─────────────────────────────────────────────
  const accept = useCallback(() => {
    const s = sessionRef.current;
    if (!s || s.direction !== "incoming" || s.phase !== "RINGING" || !s.callId) return;
    const callId = s.callId;
    stopRingtone();
    dispatch({ type: "answering", callId });

    void (async () => {
      let stream: MediaStream;
      try {
        stream = await openMedia(s.type);
      } catch (error) {
        if (callIdRef.current !== callId) return;
        // Without a microphone the call can't go ahead; let the caller know it was declined.
        socketRef.current?.emit("call:reject", { callId });
        const e = error instanceof CallMediaError ? error : new CallMediaError("CALL_FAILED", FAILED_MESSAGE);
        finish(callId, "FAILED", e.message, e.code);
        return;
      }
      if (callIdRef.current !== callId) return stopStream(stream);

      // Ready before accepting, so an offer that arrives right away finds the connection.
      createPeer(callId, stream, await resolveIceServers());
      if (callIdRef.current !== callId) return;
      try {
        await request("call:accept", { callId });
      } catch (error) {
        if (callIdRef.current !== callId) return;
        const e = error instanceof CallRequestError ? error : new CallRequestError("CALL_FAILED", FAILED_MESSAGE);
        finish(callId, e.code === "CALL_ENDED" ? "MISSED" : "FAILED", e.message, e.code as CallErrorCode);
        return;
      }
      dispatch({ type: "accepted", callId });
      dispatch({ type: "connecting", callId });
    })();
  }, [openMedia, createPeer, request, finish]);

  const reject = useCallback(() => {
    const s = sessionRef.current;
    if (!s || s.direction !== "incoming" || s.phase !== "RINGING" || !s.callId) return;
    socketRef.current?.emit("call:reject", { callId: s.callId });
    teardown();
    callIdRef.current = null;
    dispatch({ type: "dismiss" });
    refreshHistory(s.peer.id);
  }, [teardown, refreshHistory]);

  const end = useCallback(() => {
    const s = sessionRef.current;
    if (!s) return;
    if (isTerminal(s.phase)) return dispatch({ type: "dismiss" });
    if (s.direction === "incoming" && s.phase === "RINGING") return reject();
    if (!s.callId) {
      // Still getting the microphone or placing the call.
      dialToken.current += 1;
      return finish(null, "ENDED", "Call cancelled.");
    }
    socketRef.current?.emit("call:end", { callId: s.callId });
    const duration = s.connectedAt ? Math.round((Date.now() - s.connectedAt) / 1000) : 0;
    finish(s.callId, "ENDED", s.phase === "RINGING" ? "Call cancelled." : "Call ended.", null, duration);
  }, [reject, finish]);

  const toggleMute = useCallback(() => {
    const s = sessionRef.current;
    if (!isLive(s)) return;
    for (const track of localRef.current?.getAudioTracks() ?? []) track.enabled = s.muted;
    dispatch({ type: "toggle-mute" });
    shareMediaState(!s.muted, s.cameraOff);
  }, [shareMediaState]);

  const toggleCamera = useCallback(() => {
    const s = sessionRef.current;
    if (!isLive(s) || s.type !== "VIDEO" || s.cameraUnavailable) return;
    for (const track of localRef.current?.getVideoTracks() ?? []) track.enabled = s.cameraOff;
    dispatch({ type: "toggle-camera" });
    shareMediaState(s.muted, !s.cameraOff);
  }, [shareMediaState]);

  const dismiss = useCallback(() => {
    if (sessionRef.current && isTerminal(sessionRef.current.phase)) dispatch({ type: "dismiss" });
  }, []);

  // ── Signaling from the server ─────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const onIncoming = ({ call }: { call: CallDto }) => {
      if (isLive(sessionRef.current) || callIdRef.current) return; // the server marks us busy; this is a stray duplicate
      teardown();
      callIdRef.current = call.id;
      dispatch({ type: "incoming", callId: call.id, peer: call.caller, callType: call.type });
      playIncomingRingtone();
    };

    const onAccepted = ({ callId }: { callId: string }) => {
      const s = sessionRef.current;
      if (callIdRef.current !== callId || s?.direction !== "outgoing" || peerRef.current) return;
      stopRingtone();
      dispatch({ type: "accepted", callId });
      void (async () => {
        const stream = localRef.current;
        if (!stream) return fail(callId);
        const peer = createPeer(callId, stream, await (iceRef.current ?? resolveIceServers()));
        if (callIdRef.current !== callId) return;
        dispatch({ type: "connecting", callId });
        try {
          const description = await peer.createOffer();
          await request("call:offer", { callId, description });
        } catch {
          if (callIdRef.current === callId) fail(callId);
        }
      })();
    };

    const onOffer = ({ callId, description }: { callId: string; description: SessionDescription }) => {
      const peer = peerRef.current;
      if (callIdRef.current !== callId || !peer) return;
      void (async () => {
        try {
          const answer = await peer.acceptOffer(description);
          await request("call:answer", { callId, description: answer });
        } catch {
          if (callIdRef.current === callId) fail(callId);
        }
      })();
    };

    const onAnswer = ({ callId, description }: { callId: string; description: SessionDescription }) => {
      if (callIdRef.current !== callId) return;
      peerRef.current?.applyAnswer(description).catch(() => fail(callId));
    };

    const onCandidate = ({ callId, candidate }: { callId: string; candidate: IceCandidate }) => {
      if (callIdRef.current === callId) void peerRef.current?.addIceCandidate(candidate);
    };

    const onAnsweredElsewhere = ({ callId }: { callId: string }) => {
      const s = sessionRef.current;
      if (callIdRef.current !== callId || s?.direction !== "incoming" || s.phase !== "RINGING") return;
      teardown();
      callIdRef.current = null;
      dispatch({ type: "dismiss", callId });
    };

    const onEnded = ({ callId, status, reason, durationSeconds }: CallEndedEvent) => {
      const s = sessionRef.current;
      if (callIdRef.current !== callId || !s || isTerminal(s.phase)) {
        refreshHistory(s?.peer.id);
        return;
      }
      if (s.direction === "incoming" && s.phase === "RINGING") {
        // The caller gave up, or it rang out: stop ringing and leave a trace.
        teardown();
        callIdRef.current = null;
        dispatch({ type: "dismiss", callId });
        refreshHistory(s.peer.id);
        toast(`Missed ${s.type === "VIDEO" ? "video" : "voice"} call`, { description: `from ${s.peer.firstName} ${s.peer.lastName}` });
        return;
      }
      finish(callId, phaseForStatus(status), outcomeMessage(reason, s), null, durationSeconds);
    };

    const onMediaState = ({ callId, state }: { callId: string; state: RemoteMedia }) => {
      if (callIdRef.current === callId) setRemoteMedia({ muted: Boolean(state.muted), cameraOff: Boolean(state.cameraOff) });
    };

    // The socket reconnected (network change, session refresh): point the call at this connection again.
    const onReconnect = () => {
      const s = sessionRef.current;
      const callId = callIdRef.current;
      if (!callId || !isLive(s) || (s.direction === "incoming" && s.phase === "RINGING")) return;
      request("call:resume", { callId }).catch(() => {
        if (callIdRef.current === callId) finish(callId, "FAILED", "The call was disconnected.", "SIGNALING_CONNECTION_FAILED");
      });
    };

    socket.on("call:incoming", onIncoming);
    socket.on("call:accepted", onAccepted);
    socket.on("call:offer", onOffer);
    socket.on("call:answer", onAnswer);
    socket.on("call:ice-candidate", onCandidate);
    socket.on("call:answered-elsewhere", onAnsweredElsewhere);
    socket.on("call:ended", onEnded);
    socket.on("call:media-state", onMediaState);
    socket.on("connect", onReconnect);
    return () => {
      socket.off("call:incoming", onIncoming);
      socket.off("call:accepted", onAccepted);
      socket.off("call:offer", onOffer);
      socket.off("call:answer", onAnswer);
      socket.off("call:ice-candidate", onCandidate);
      socket.off("call:answered-elsewhere", onAnsweredElsewhere);
      socket.off("call:ended", onEnded);
      socket.off("call:media-state", onMediaState);
      socket.off("connect", onReconnect);
    };
  }, [socket, teardown, createPeer, request, fail, finish, refreshHistory]);

  // An outcome is shown for a moment, then the call UI goes away.
  useEffect(() => {
    if (!session || !isTerminal(session.phase)) return;
    const timer = setTimeout(() => dispatch({ type: "dismiss" }), session.phase === "FAILED" ? OUTCOME_MS * 2 : OUTCOME_MS);
    return () => clearTimeout(timer);
  }, [session]);

  // Closing or leaving the tab hangs up (the server also ends it if the tab just vanishes).
  useEffect(() => {
    const hangUp = () => {
      const s = sessionRef.current;
      const callId = callIdRef.current;
      if (!callId || !isLive(s) || (s.direction === "incoming" && s.phase === "RINGING")) return;
      socketRef.current?.emit("call:end", { callId });
      teardown();
    };
    window.addEventListener("pagehide", hangUp);
    return () => {
      window.removeEventListener("pagehide", hangUp);
      // Signing out or unmounting the app: nothing may keep the camera or microphone open.
      hangUp();
      teardown();
    };
  }, [teardown]);

  const value = useMemo<CallContextValue>(
    () => ({ available: Boolean(user), session, localStream, remoteStream, remoteMedia, startCall, accept, reject, end, toggleMute, toggleCamera, dismiss }),
    [user, session, localStream, remoteStream, remoteMedia, startCall, accept, reject, end, toggleMute, toggleCamera, dismiss],
  );

  return (
    <CallContext.Provider value={value}>
      {children}
      <CallOverlay />
    </CallContext.Provider>
  );
}
