import { io, type Socket } from "socket.io-client";
import { ensureFreshSession, refreshSession } from "@/lib/api/client";
import { logDiagnostic } from "@/lib/api/errors";
import type { ChatConnectionState } from "@/types/chat";

/**
 * Same origin, under /api: the Next server already proxies /api/* to the
 * backend (next.config.ts), so the browser sends the httpOnly session cookie
 * with the handshake exactly as it does for REST calls. No token in JS.
 */
const SOCKET_PATH = "/api/socket.io";
/** Consecutive auth failures before giving up and asking the user to sign in. */
const MAX_AUTH_ATTEMPTS = 3;
/** Grace period before closing an unused socket, so a remount (StrictMode, navigation) reuses it. */
const RELEASE_DELAY_MS = 2_000;

let socket: Socket | null = null;
let holders = 0;
let releaseTimer: ReturnType<typeof setTimeout> | undefined;
let authAttempts = 0;
let state: ChatConnectionState = "connecting";
const stateListeners = new Set<() => void>();

function setState(next: ChatConnectionState) {
  if (state === next) return;
  state = next;
  for (const listener of stateListeners) listener();
}

/** Refresh the session (the access cookie lapses every few minutes), then dial again. */
async function reconnectWithFreshSession(force: boolean) {
  if (!socket) return;
  if (++authAttempts > MAX_AUTH_ATTEMPTS) {
    setState("unauthorized");
    return;
  }
  const ok = force ? await refreshSession() : (await ensureFreshSession(), true);
  if (!ok) {
    setState("unauthorized");
    return;
  }
  socket?.connect();
}

function create(): Socket {
  const s = io({
    path: SOCKET_PATH,
    addTrailingSlash: false,
    withCredentials: true,
    autoConnect: false,
    reconnectionDelay: 1_000,
    reconnectionDelayMax: 10_000,
  });

  s.on("connect", () => {
    authAttempts = 0;
    setState("connected");
  });

  s.on("disconnect", (reason) => {
    if (reason === "io client disconnect") return;
    setState("reconnecting");
    // The server only hangs up on purpose when the session lapsed; Socket.IO won't redial that on its own.
    if (reason === "io server disconnect") void reconnectWithFreshSession(false);
  });

  s.on("connect_error", (err) => {
    setState(state === "connected" || state === "reconnecting" ? "reconnecting" : "connecting");
    if (s.active) return; // transport trouble — Socket.IO keeps retrying with backoff
    logDiagnostic("info", `chat socket refused: ${err.message}`);
    // Refused by the server's auth check: the cookie is missing or stale.
    void reconnectWithFreshSession(err.message === "UNAUTHENTICATED");
  });

  return s;
}

/**
 * The one chat socket for this browser tab, shared by every component that
 * needs it. Pair each call with {@link releaseChatSocket}.
 */
export function acquireChatSocket(): Socket {
  clearTimeout(releaseTimer);
  holders += 1;
  if (!socket) {
    socket = create();
    setState("connecting");
    void ensureFreshSession().then(() => socket?.connect());
  }
  return socket;
}

export function releaseChatSocket() {
  holders = Math.max(0, holders - 1);
  if (holders > 0) return;
  clearTimeout(releaseTimer);
  releaseTimer = setTimeout(() => {
    if (holders > 0 || !socket) return;
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
    setState("connecting");
  }, RELEASE_DELAY_MS);
}

/** After the user signs in again elsewhere (or on demand), try once more. */
export function retryChatSocket() {
  authAttempts = 0;
  setState("connecting");
  void reconnectWithFreshSession(true);
}

export const chatConnection = {
  subscribe(listener: () => void) {
    stateListeners.add(listener);
    return () => stateListeners.delete(listener);
  },
  getState: () => state,
};
