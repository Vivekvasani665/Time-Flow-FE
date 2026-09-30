"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/auth-provider";
import type { ConversationController } from "@/components/chat/conversation-panel";
import { isApiError } from "@/lib/api/errors";
import { ASSISTANT_ACCEPT, ASSISTANT_ATTACHMENT_LIMITS, prepareAttachment } from "@/lib/assistant-attachments";
import { queryKeys } from "@/lib/query-keys";
import { assistantService, type AssistantTurn } from "@/services/assistant.service";
import { ASSISTANT_USER, type AssistantAttachment, type AssistantEvent, type ChatMessageView } from "@/types/chat";

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

/** Pictures are too big for session storage; their names stay so the conversation still reads right. */
const withoutImageData = (m: ChatMessageView): ChatMessageView =>
  m.attachments?.some((a) => a.kind === "image")
    ? { ...m, attachments: m.attachments.map((a) => (a.kind === "image" ? { ...a, dataUrl: null } : a)) }
    : m;

function save(userId: string, messages: ChatMessageView[]) {
  try {
    sessionStorage.setItem(STORAGE_PREFIX + userId, JSON.stringify(messages.map(withoutImageData)));
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

/**
 * The conversation as the API takes it. Files are sent again with every
 * question (the server keeps nothing), newest first until the size limits
 * are reached; anything older is named instead so the model knows it existed.
 */
function toTurns(history: ChatMessageView[]): AssistantTurn[] {
  let images = ASSISTANT_ATTACHMENT_LIMITS.images;
  let chars = ASSISTANT_ATTACHMENT_LIMITS.documentChars;
  const newestFirst = [...history].reverse().map((m): AssistantTurn => {
    if (m.sender.id === ASSISTANT_USER.id) return { role: "assistant", content: m.content };
    const sent: NonNullable<Extract<AssistantTurn, { role: "user" }>["attachments"]> = [];
    const gone: string[] = [];
    for (const a of m.attachments ?? []) {
      if (a.kind === "image" && a.dataUrl && images > 0) {
        images--;
        sent.push({ kind: "image", name: a.name, dataUrl: a.dataUrl });
      } else if (a.kind === "document" && a.text.length <= chars) {
        chars -= a.text.length;
        sent.push({ kind: "document", name: a.name, text: a.text });
      } else {
        gone.push(a.name);
      }
    }
    const note = gone.length ? `[Attached earlier, no longer available to you: ${gone.join(", ")}]` : "";
    const content = [m.content, note].filter(Boolean).join("\n\n");
    return sent.length ? { role: "user", content, attachments: sent } : { role: "user", content };
  });
  return newestFirst.reverse();
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
    const turns = toTurns(
      messagesRef.current
        .slice(0, upTo + 1)
        .filter((m) => !m.deletedAt && (m.content || m.attachments?.length) && (m.id === questionId || m.status === undefined))
        .slice(-MAX_TURNS),
    );
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
    (content: string, _replyTo: ChatMessageView | null = null, attachments?: AssistantAttachment[]) => {
      if (!user) return;
      if (busy) {
        toast("One moment", { description: "The assistant is still answering your last question." });
        return;
      }
      const question = message(
        { id: user.id, firstName: user.firstName, lastName: user.lastName, avatarUrl: user.avatarUrl },
        content,
        attachments?.length ? { status: "sending", attachments } : { status: "sending" },
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
    attach: ATTACH,
  };

  return { controller, clear, busy, enabled: status.data?.enabled ?? null };
}

const ATTACH = { accept: ASSISTANT_ACCEPT, max: ASSISTANT_ATTACHMENT_LIMITS.perMessage, prepare: prepareAttachment };

function noop() {}
