"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { Socket } from "socket.io-client";
import { useAuth } from "@/components/auth/auth-provider";
import { ApiError, isApiError } from "@/lib/api/errors";
import {
  addOptimistic,
  discardPending,
  EMPTY_TIMELINE,
  markFailed,
  markSending,
  mergeLatest,
  prependOlder,
  setReactions,
  upsertMessage,
  type ChatTimeline,
} from "@/lib/chat-state";
import { notifyError } from "@/lib/notify";
import { queryKeys } from "@/lib/query-keys";
import { chatService } from "@/services/chat.service";
import type {
  ChatAck,
  ChatMessage,
  ChatMessageView,
  ChatReactionUpdate,
  ChatTypingEvent,
  ChatUnread,
  ChatUser,
} from "@/types/chat";
import { useChatSocket } from "./use-chat-socket";

export const CHAT_PATH = "/chat";

// Whether Global Chat is on screen in this tab: its messages are being read, so they aren't unread.
let liveChatViewers = 0;
const liveChatListeners = new Set<() => void>();
const liveChatViewing = {
  enter() {
    liveChatViewers += 1;
    for (const l of liveChatListeners) l();
  },
  leave() {
    liveChatViewers = Math.max(0, liveChatViewers - 1);
    for (const l of liveChatListeners) l();
  },
  subscribe(listener: () => void) {
    liveChatListeners.add(listener);
    return () => liveChatListeners.delete(listener);
  },
  get: () => liveChatViewers > 0,
};
const PAGE_SIZE = 50;
const ACK_TIMEOUT_MS = 10_000;
/** A typing indicator nobody refreshed within this long is assumed stale (a lost "stop"). */
const TYPING_TTL_MS = 6_000;
const MARK_READ_DELAY_MS = 1_500;

const SEND_FAILED = "Your message couldn't be sent. Please try again.";

type SendPayload = { content: string; replyToId: string | null; clientId: string };

/** What the user reads when a chat action fails: the specific reason when the API gave one. */
export function chatErrorMessage(error: unknown, fallback = SEND_FAILED): string {
  if (isApiError(error)) {
    if (error.status === 0 || error.status >= 500) return fallback;
    return error.details[0]?.message ?? error.message;
  }
  return fallback;
}

/** Socket call with a timeout; a refusal becomes the same ApiError a REST call would throw. */
async function emitWithAck<T>(socket: Socket, event: string, payload: unknown): Promise<T> {
  let ack: ChatAck<T>;
  try {
    ack = (await socket.timeout(ACK_TIMEOUT_MS).emitWithAck(event, payload)) as ChatAck<T>;
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", `${event} timed out`);
  }
  if (!ack.ok) throw new ApiError(ack.error.statusCode, ack.error.code, ack.error.message, ack.error.details ?? []);
  return ack.data;
}

/**
 * Everything the chat screen needs. Live updates arrive over the shared socket;
 * history is loaded over REST, and sending falls back to REST while the socket
 * is reconnecting, so a flaky connection never loses a message.
 */
export function useChat() {
  const { user } = useAuth();
  const me = user?.id ?? null;
  const qc = useQueryClient();
  const { socket, state } = useChatSocket(Boolean(user));

  const [timeline, setTimeline] = useState<ChatTimeline>(EMPTY_TIMELINE);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState<unknown>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [online, setOnline] = useState<ChatUser[]>([]);
  const [typingUsers, setTypingUsers] = useState<ChatUser[]>([]);

  // Where "New messages" starts: the read position from before this visit.
  const [unreadSince] = useState<string | null>(() => {
    const unread = qc.getQueryData<ChatUnread>(queryKeys.chat.unread);
    return unread && unread.count > 0 ? (unread.lastReadAt ?? new Date(0).toISOString()) : null;
  });

  useEffect(() => {
    liveChatViewing.enter();
    return () => liveChatViewing.leave();
  }, []);

  const payloads = useRef(new Map<string, SendPayload>());
  const typingTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const timelineRef = useRef(timeline);
  timelineRef.current = timeline;
  const loadedOnce = useRef(false);

  // ── Read state ────────────────────────────────────────────
  const markReadTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const markRead = useCallback(() => {
    clearTimeout(markReadTimer.current);
    markReadTimer.current = setTimeout(() => {
      if (document.visibilityState !== "visible") return;
      qc.setQueryData<ChatUnread>(queryKeys.chat.unread, (prev) => ({ count: 0, lastReadAt: prev?.lastReadAt ?? null }));
      chatService.markRead().catch(() => undefined);
    }, MARK_READ_DELAY_MS);
  }, [qc]);

  useEffect(() => {
    markRead();
    const onVisible = () => document.visibilityState === "visible" && markRead();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      clearTimeout(markReadTimer.current);
    };
  }, [markRead]);

  // ── History ───────────────────────────────────────────────
  const loadLatest = useCallback(async (initial: boolean) => {
    if (initial) setStatus("loading");
    try {
      const page = await chatService.list({ limit: PAGE_SIZE });
      setTimeline((prev) => mergeLatest(prev, page, initial));
      setStatus("ready");
      loadedOnce.current = true;
    } catch (error) {
      if (!initial) return; // a failed resync leaves what's on screen alone
      setLoadError(error);
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    if (me) void loadLatest(true);
  }, [me, loadLatest]);

  const loadOlder = useCallback(async () => {
    const { hasMore, cursor } = timelineRef.current;
    if (!hasMore || !cursor || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const page = await chatService.list({ before: cursor, limit: PAGE_SIZE });
      setTimeline((prev) => prependOlder(prev, page));
    } catch (error) {
      notifyError(error, { title: "Couldn't load earlier messages" });
    } finally {
      setLoadingOlder(false);
    }
  }, [loadingOlder]);

  // ── Live events ───────────────────────────────────────────
  const setTyping = useCallback((person: ChatUser, isTyping: boolean) => {
    clearTimeout(typingTimers.current.get(person.id));
    typingTimers.current.delete(person.id);
    if (isTyping) {
      typingTimers.current.set(
        person.id,
        setTimeout(() => setTyping(person, false), TYPING_TTL_MS),
      );
    }
    setTypingUsers((prev) => {
      const others = prev.filter((u) => u.id !== person.id);
      return isTyping ? [...others, person] : others;
    });
  }, []);

  useEffect(() => {
    if (!socket) return;

    const join = () => {
      void emitWithAck<{ online: ChatUser[] }>(socket, "chat:join", {})
        .then(({ online: users }) => setOnline(users))
        .catch(() => undefined);
      // Anything sent while we were disconnected.
      if (loadedOnce.current) void loadLatest(false);
    };
    const onMessage = (message: ChatMessage) => {
      setTimeline((prev) => upsertMessage(prev, message));
      setTyping(message.sender, false);
      if (message.sender.id !== me) markRead();
    };
    const onChanged = (message: ChatMessage) => setTimeline((prev) => upsertMessage(prev, message));
    const onReactions = ({ messageId, reactions }: ChatReactionUpdate) => setTimeline((prev) => setReactions(prev, messageId, reactions));
    const onTyping = ({ user: person, isTyping }: ChatTypingEvent) => {
      if (person.id !== me) setTyping(person, isTyping);
    };
    const onOnline = ({ user: person }: { user: ChatUser }) =>
      setOnline((prev) => (prev.some((u) => u.id === person.id) ? prev : [...prev, person]));
    const onOffline = ({ userId }: { userId: string }) => {
      setOnline((prev) => prev.filter((u) => u.id !== userId));
      clearTimeout(typingTimers.current.get(userId));
      typingTimers.current.delete(userId);
      setTypingUsers((prev) => prev.filter((u) => u.id !== userId));
    };

    socket.on("connect", join);
    socket.on("chat:message:new", onMessage);
    socket.on("chat:message:updated", onChanged);
    socket.on("chat:message:deleted", onChanged);
    socket.on("chat:reaction:updated", onReactions);
    socket.on("chat:typing", onTyping);
    socket.on("chat:user:online", onOnline);
    socket.on("chat:user:offline", onOffline);
    if (socket.connected) join();

    return () => {
      socket.off("connect", join);
      socket.off("chat:message:new", onMessage);
      socket.off("chat:message:updated", onChanged);
      socket.off("chat:message:deleted", onChanged);
      socket.off("chat:reaction:updated", onReactions);
      socket.off("chat:typing", onTyping);
      socket.off("chat:user:online", onOnline);
      socket.off("chat:user:offline", onOffline);
    };
  }, [socket, me, loadLatest, markRead, setTyping]);

  useEffect(() => {
    const timers = typingTimers.current;
    return () => {
      for (const t of timers.values()) clearTimeout(t);
      timers.clear();
    };
  }, []);

  // ── Actions ───────────────────────────────────────────────
  /** The socket when it's usable right now; otherwise actions go over REST. */
  const live = state === "connected" ? socket : null;

  const deliver = useCallback(
    async (payload: SendPayload) => {
      try {
        const saved = live
          ? await emitWithAck<ChatMessage>(live, "chat:message", payload)
          : await chatService.send(payload);
        setTimeline((prev) => upsertMessage(prev, { ...saved, clientId: payload.clientId }));
        payloads.current.delete(payload.clientId);
      } catch (error) {
        setTimeline((prev) => markFailed(prev, payload.clientId, chatErrorMessage(error)));
      }
    },
    [live],
  );

  const sendMessage = useCallback(
    (content: string, replyTo: ChatMessageView | null = null) => {
      if (!user) return;
      const clientId = crypto.randomUUID();
      const now = new Date().toISOString();
      const payload: SendPayload = { content, replyToId: replyTo?.id ?? null, clientId };
      payloads.current.set(clientId, payload);
      setTimeline((prev) =>
        addOptimistic(prev, {
          id: clientId,
          content,
          sender: { id: user.id, firstName: user.firstName, lastName: user.lastName, avatarUrl: user.avatarUrl },
          replyTo: replyTo
            ? { id: replyTo.id, content: replyTo.content, deleted: false, sender: replyTo.sender }
            : null,
          reactions: [],
          editedAt: null,
          deletedAt: null,
          createdAt: now,
          updatedAt: now,
        }),
      );
      void deliver(payload);
    },
    [user, deliver],
  );

  const retryMessage = useCallback(
    (clientId: string) => {
      const payload = payloads.current.get(clientId);
      if (!payload) return;
      setTimeline((prev) => markSending(prev, clientId));
      void deliver(payload);
    },
    [deliver],
  );

  const discardMessage = useCallback((clientId: string) => {
    payloads.current.delete(clientId);
    setTimeline((prev) => discardPending(prev, clientId));
  }, []);

  const editMessage = useCallback(
    async (id: string, content: string) => {
      try {
        const saved = live
          ? await emitWithAck<ChatMessage>(live, "chat:message:edit", { id, content })
          : await chatService.edit(id, content);
        setTimeline((prev) => upsertMessage(prev, saved));
        return true;
      } catch (error) {
        notifyError(error, { title: "Couldn't edit the message" });
        return false;
      }
    },
    [live],
  );

  const deleteMessage = useCallback(
    async (id: string) => {
      try {
        const saved = live
          ? await emitWithAck<ChatMessage>(live, "chat:message:delete", { id })
          : await chatService.remove(id);
        setTimeline((prev) => upsertMessage(prev, saved));
        return true;
      } catch (error) {
        notifyError(error, { title: "Couldn't delete the message" });
        return false;
      }
    },
    [live],
  );

  const toggleReaction = useCallback(
    async (message: ChatMessageView, emoji: string) => {
      if (!me) return;
      const mine = message.reactions.find((r) => r.emoji === emoji)?.userIds.includes(me) ?? false;
      try {
        const update = live
          ? await emitWithAck<ChatReactionUpdate>(live, mine ? "chat:reaction:remove" : "chat:reaction:add", { messageId: message.id, emoji })
          : await (mine ? chatService.removeReaction(message.id, emoji) : chatService.addReaction(message.id, emoji));
        setTimeline((prev) => setReactions(prev, update.messageId, update.reactions));
      } catch (error) {
        notifyError(error, { title: "Couldn't update the reaction" });
      }
    },
    [live, me],
  );

  const startTyping = useCallback(() => {
    live?.emit("chat:typing:start");
  }, [live]);

  const stopTyping = useCallback(() => {
    live?.emit("chat:typing:stop");
  }, [live]);

  const retryLoad = useCallback(() => loadLatest(true), [loadLatest]);

  return {
    me,
    unreadSince,
    messages: timeline.messages,
    hasMore: timeline.hasMore,
    status,
    loadError,
    loadingOlder,
    connection: state,
    online,
    typingUsers,
    sendMessage,
    retryMessage,
    discardMessage,
    editMessage,
    deleteMessage,
    toggleReaction,
    startTyping,
    stopTyping,
    loadOlder,
    retryLoad,
  };
}

/**
 * Unread count of Global Chat (# General), for badges. Counts up live from the
 * shared socket and is cleared when it is opened (in this tab or any other).
 */
export function useChatUnread(): number {
  const { user } = useAuth();
  const qc = useQueryClient();
  const viewing = useSyncExternalStore(liveChatViewing.subscribe, liveChatViewing.get, () => false);
  const { socket } = useChatSocket(Boolean(user));

  const query = useQuery({
    queryKey: queryKeys.chat.unread,
    queryFn: chatService.unread,
    enabled: Boolean(user),
    refetchInterval: 60_000,
  });

  const viewingRef = useRef(viewing);
  viewingRef.current = viewing;

  useEffect(() => {
    if (!socket || !user) return;
    const onMessage = (message: ChatMessage) => {
      if (message.sender.id === user.id || viewingRef.current) return;
      qc.setQueryData<ChatUnread>(queryKeys.chat.unread, (prev) => ({
        count: Math.min((prev?.count ?? 0) + 1, 100),
        lastReadAt: prev?.lastReadAt ?? null,
      }));
    };
    const onRead = ({ lastReadAt }: { lastReadAt: string }) =>
      qc.setQueryData<ChatUnread>(queryKeys.chat.unread, { count: 0, lastReadAt });
    // Whatever arrived while disconnected.
    const onReconnect = () => void qc.invalidateQueries({ queryKey: queryKeys.chat.unread });

    socket.on("chat:message:new", onMessage);
    socket.on("chat:read", onRead);
    socket.io.on("reconnect", onReconnect);
    return () => {
      socket.off("chat:message:new", onMessage);
      socket.off("chat:read", onRead);
      socket.io.off("reconnect", onReconnect);
    };
  }, [socket, user, qc]);

  return useMemo(() => (viewing ? 0 : (query.data?.count ?? 0)), [viewing, query.data]);
}

