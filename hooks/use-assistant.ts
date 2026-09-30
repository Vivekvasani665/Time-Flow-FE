"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/auth-provider";
import type { ConversationController } from "@/components/chat/conversation-panel";
import { isApiError } from "@/lib/api/errors";
import { queryKeys } from "@/lib/query-keys";
import { assistantService, type AssistantTurn } from "@/services/assistant.service";
import { ASSISTANT_USER, type AssistantEvent, type ChatMessageView } from "@/types/chat";

const STORAGE_PREFIX = "tf.assistant.";
/** The API accepts up to 40 turns; older ones are dropped from what is sent, not from the screen. */
const MAX_TURNS = 40;

function load(userId: string): ChatMessageView[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_PREFIX + userId);
    return raw ? (JSON.parse(raw) as ChatMessageView[]) : [];
  } catch {
    return [];
  }
}

function save(userId: string, messages: ChatMessageView[]) {
  try {
    sessionStorage.setItem(STORAGE_PREFIX + userId, JSON.stringify(messages));
  } catch {
    /* storage full or blocked — the conversation just won't survive a reload */
  }
}

function failureText(error: unknown): string {
  if (isApiError(error)) {
    if (error.code === "ASSISTANT_DISABLED") return "The assistant isn't set up yet.";
    if (error.status === 0) return "You're offline. Check your connection and try again.";
    if (error.status < 500) return error.message;
  }
  return "The assistant couldn't answer. Please try again.";
}

function message(sender: ChatMessageView["sender"], content: string, extra: Partial<ChatMessageView> = {}): ChatMessageView {
  const now = new Date().toISOString();
  return { id: `local-${crypto.randomUUID()}`, content, sender, replyTo: null, reactions: [], editedAt: null, deletedAt: null, createdAt: now, updatedAt: now, ...extra };
}

/**
 * The TimeFlow Assistant conversation. History lives in this tab's session
 * storage and is sent whole with each question (the server keeps nothing);
 * the answer streams in as it is written.
 */
export function useAssistant() {
  const { user } = useAuth();
  const me = user?.id ?? null;
  const [messages, setMessages] = useState<ChatMessageView[]>(() => (me ? load(me) : []));
  const [busy, setBusy] = useState(false);
  const [statusText, setStatusText] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const status = useQuery({ queryKey: queryKeys.assistant.status, queryFn: assistantService.status, staleTime: 5 * 60_000, enabled: Boolean(me) });

  // Saved between answers, not on every streamed word.
  useEffect(() => {
    if (me && !busy) save(me, messages);
  }, [me, busy, messages]);

  // Leaving the conversation stops the answer (and the spend); what arrived stays.
  useEffect(() => () => abortRef.current?.abort(), []);

  const run = useCallback(async (questionId: string) => {
    const upTo = messagesRef.current.findIndex((m) => m.id === questionId);
    const turns: AssistantTurn[] = messagesRef.current
      .slice(0, upTo + 1)
      .filter((m) => !m.deletedAt && m.content && (m.id === questionId || m.status === undefined))
      .map((m): AssistantTurn => ({ role: m.sender.id === ASSISTANT_USER.id ? "assistant" : "user", content: m.content }))
      .slice(-MAX_TURNS);
    // The API wants the history to start with the user.
    while (turns[0]?.role === "assistant") turns.shift();

    const abort = new AbortController();
    abortRef.current = abort;
    setBusy(true);
    setStatusText("Thinking…");

    let replyId: string | null = null;
    let settled = false;
    const confirmQuestion = () => {
      if (settled) return;
      settled = true;
      setMessages((prev) => prev.map((m) => (m.id === questionId ? { ...m, status: undefined, error: undefined } : m)));
    };
    const appendReply = (text: string) => {
      confirmQuestion();
      if (replyId === null) {
        const reply = message(ASSISTANT_USER, text);
        replyId = reply.id;
        setMessages((prev) => [...prev, reply]);
      } else {
        const id = replyId;
        setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, content: m.content + text } : m)));
      }
    };

    const onEvent = (event: AssistantEvent) => {
      if (event.type === "delta") {
        setStatusText(null);
        appendReply(event.text);
      } else if (event.type === "status") {
        confirmQuestion();
        setStatusText(event.text);
      } else if (event.type === "error") {
        if (replyId === null) {
          setMessages((prev) => prev.map((m) => (m.id === questionId ? { ...m, status: "failed", error: event.message } : m)));
          settled = true;
        } else {
          appendReply(`\n\n(${event.message})`);
        }
      }
    };

    try {
      await assistantService.chat(turns, onEvent, abort.signal);
      if (!settled && replyId === null) confirmQuestion();
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        // Stopped by the user: the question stands, with whatever answer had arrived.
        confirmQuestion();
      } else {
        const text = failureText(error);
        setMessages((prev) => prev.map((m) => (m.id === questionId ? { ...m, status: "failed", error: text } : m)));
        if (isApiError(error) && error.status === 429) toast.error("Slow down a little", { description: text });
      }
    } finally {
      if (abortRef.current === abort) abortRef.current = null;
      setBusy(false);
      setStatusText(null);
    }
  }, []);

  const sendMessage = useCallback(
    (content: string) => {
      if (!user) return;
      if (busy) {
        toast("One moment", { description: "The assistant is still answering your last question." });
        return;
      }
      const question = message(
        { id: user.id, firstName: user.firstName, lastName: user.lastName, avatarUrl: user.avatarUrl },
        content,
        { status: "sending" },
      );
      messagesRef.current = [...messagesRef.current, question];
      setMessages(messagesRef.current);
      void run(question.id);
    },
    [user, busy, run],
  );

  const retryMessage = useCallback(
    (id: string) => {
      if (busy) return;
      setMessages((prev) => {
        const next = prev.map((m) => (m.id === id ? { ...m, status: "sending" as const, error: undefined } : m));
        messagesRef.current = next;
        return next;
      });
      void run(id);
    },
    [busy, run],
  );

  const discardMessage = useCallback((id: string) => setMessages((prev) => prev.filter((m) => m.id !== id)), []);

  const stop = useCallback(() => abortRef.current?.abort(), []);

  const clear = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    if (me) save(me, []);
  }, [me]);

  const controller: ConversationController = {
    me,
    messages,
    status: "ready",
    hasMore: false,
    loadingOlder: false,
    loadOlder: noop,
    typingUsers: busy && statusText ? [ASSISTANT_USER] : [],
    typingLabel: statusText ? `TimeFlow Assistant · ${statusText}` : undefined,
    canModerate: false,
    sendMessage,
    editMessage: async () => false,
    deleteMessage: async () => false,
    toggleReaction: noop,
    retryMessage,
    discardMessage,
    startTyping: noop,
    stopTyping: noop,
    onStop: busy ? stop : undefined,
  };

  return { controller, clear, busy, enabled: status.data?.enabled ?? null };
}

function noop() {}
