"use client";

import { Info, LogIn, PhoneCall, WifiOff } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePermissions } from "@/components/auth/auth-provider";
import { CallButtons } from "@/components/calls/call-buttons";
import { buttonClasses } from "@/components/ui/button";
import type { ChatWorkspace } from "@/hooks/use-chat-workspace";
import { useAssistant } from "@/hooks/use-assistant";
import { useCallHistory } from "@/hooks/use-call-contacts";
import { CHAT_PATH, useChat } from "@/hooks/use-chat";
import type { CallHistoryItem } from "@/types/call";
import type { ChatConversation, ChatMessage, ChatMessageView } from "@/types/chat";
import { ConversationHeader, LivePresence } from "./conversation-header";
import { ConversationPanel, type ConversationController } from "./conversation-panel";

type ConversationViewProps = {
  conversation: ChatConversation;
  workspace: ChatWorkspace;
  focusId: string | null;
  onBack: () => void;
  onSearch: () => void;
};

function copyFor(conversation: ChatConversation) {
  const channel = conversation.kind === "channel";
  const first = conversation.contact?.firstName ?? conversation.name;
  return {
    placeholder: channel ? `Message #${conversation.name}` : `Message ${first}`,
    beginningLabel: channel ? `This is the beginning of #${conversation.name}.` : `This is the beginning of your conversation with ${first}.`,
    emptyTitle: channel ? `Welcome to #${conversation.name}` : `Say hello to ${first}`,
    emptyDescription: channel
      ? (conversation.description ?? "Start the conversation with your team.")
      : `This is a private conversation between you and ${first}.`,
  };
}

/** # General — the real Global Chat, over the API and socket. */
export function LiveConversation({ conversation, workspace, focusId, onBack, onSearch }: ConversationViewProps) {
  const chat = useChat();
  const { can } = usePermissions();
  const controller: ConversationController = { ...chat, canModerate: can("chat.moderate") };

  const banner =
    chat.connection === "reconnecting" ? (
      <div className="flex items-center gap-2 border-b border-amber/25 bg-amber/10 px-4 py-2 text-sm text-amber" role="status">
        <WifiOff className="size-4 shrink-0" aria-hidden="true" />
        <span>
          <span className="font-semibold">Connection lost.</span> We&apos;re trying to reconnect — messages you send will still go through.
        </span>
      </div>
    ) : chat.connection === "unauthorized" ? (
      <div className="flex flex-wrap items-center gap-2 border-b border-danger/25 bg-danger/10 px-4 py-2 text-sm text-danger" role="alert">
        <LogIn className="size-4 shrink-0" aria-hidden="true" />
        <span className="flex-1">Your session has expired. Please sign in again to continue chatting.</span>
        <Link href={`/login?next=${encodeURIComponent(CHAT_PATH)}`} className={buttonClasses("secondary", "sm")}>
          Sign in
        </Link>
      </div>
    ) : null;

  return (
    <>
      <ConversationHeader
        conversation={conversation}
        onBack={onBack}
        onSearch={onSearch}
        onToggleMute={() => workspace.toggleMute(conversation.id)}
        onMarkRead={() => undefined}
      >
        <LivePresence online={chat.online} connection={chat.connection} me={chat.me} />
      </ConversationHeader>
      <ConversationPanel controller={controller} newSince={chat.unreadSince} focusId={focusId} banner={banner} {...copyFor(conversation)} />
    </>
  );
}

/** A call as a timeline entry, placed at the time it started. */
const callEntry = (call: CallHistoryItem): ChatMessageView => ({
  id: `call-${call.id}`,
  content: "",
  sender: call.caller,
  replyTo: null,
  reactions: [],
  editedAt: null,
  deletedAt: null,
  createdAt: call.startedAt,
  updatedAt: call.endedAt ?? call.startedAt,
  call,
});

/**
 * Channels and DMs that don't have a backend yet: local state from the
 * workspace. Same panel, same controller shape as the live one. A direct
 * conversation with a real team member also has calls, which are real: the
 * header can start one, and past calls appear in the timeline.
 */
export function MockConversation({ conversation, workspace, focusId, onBack, onSearch }: ConversationViewProps) {
  const { id, contact } = conversation;
  const callable = conversation.kind === "direct" && contact?.callable ? contact : null;
  const calls = useCallHistory(callable?.id ?? null);
  const messages = useMemo(() => {
    const local: ChatMessageView[] = workspace.messages[id] ?? [];
    if (!calls?.length) return local;
    return [...local, ...calls.map(callEntry)].sort((a: ChatMessage, b: ChatMessage) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));
  }, [workspace.messages, id, calls]);
  const { markRead } = workspace;

  // Captured on opening, before it is marked read: where "New messages" begins.
  const [newSince] = useState<string | null>(() => {
    if (conversation.unread === 0) return null;
    const before = messages[messages.length - conversation.unread - 1];
    return before?.createdAt ?? new Date(0).toISOString();
  });

  useEffect(() => {
    markRead(id);
  }, [id, markRead]);

  const { sendMessage, editMessage, deleteMessage, toggleReaction } = workspace;
  const controller: ConversationController = {
    me: workspace.me?.id ?? null,
    messages,
    status: "ready",
    hasMore: false,
    loadingOlder: false,
    loadOlder: noop,
    typingUsers: [],
    canModerate: false,
    sendMessage: useCallback((content: string, replyTo: ChatMessageView | null) => sendMessage(id, content, replyTo), [sendMessage, id]),
    editMessage: useCallback(
      async (messageId: string, content: string) => {
        editMessage(id, messageId, content);
        return true;
      },
      [editMessage, id],
    ),
    deleteMessage: useCallback(
      async (messageId: string) => {
        deleteMessage(id, messageId);
        return true;
      },
      [deleteMessage, id],
    ),
    toggleReaction: useCallback((message: ChatMessageView, emoji: string) => toggleReaction(id, message.id, emoji), [toggleReaction, id]),
    retryMessage: noop,
    discardMessage: noop,
    startTyping: noop,
    stopTyping: noop,
  };

  return (
    <>
      <ConversationHeader
        conversation={conversation}
        onBack={onBack}
        onSearch={onSearch}
        onToggleMute={() => workspace.toggleMute(id)}
        onMarkRead={() => markRead(id)}
      >
        {callable && <CallButtons peer={callable} />}
      </ConversationHeader>
      <ConversationPanel
        controller={controller}
        newSince={newSince}
        focusId={focusId}
        banner={
          callable ? (
            <div className="flex items-center gap-2 border-b border-line bg-panel-2 px-4 py-2 text-xs text-ink-mute" role="note">
              <PhoneCall className="size-3.5 shrink-0 text-cyan" aria-hidden="true" />
              <span>Voice and video calls with {callable.firstName} are live. Direct messages are only saved in this browser for now.</span>
            </div>
          ) : null
        }
        {...copyFor(conversation)}
      />
    </>
  );
}

function noop() {}

const ASSISTANT_SUGGESTIONS = [
  "Which of my tasks are overdue?",
  "What should I focus on today?",
  "Create a task and assign it to whoever is least busy",
  "Translate this into Hindi: The release is moved to Friday",
];

/** TimeFlow Assistant — an AI chat for work: it looks up, creates and assigns tasks, translates, writes, and reads attached files. */
export function AssistantConversation({ conversation, focusId, onBack, onSearch }: Omit<ConversationViewProps, "workspace">) {
  const assistant = useAssistant();
  const banner =
    assistant.enabled === false ? (
      <div className="flex items-center gap-2 border-b border-amber/25 bg-amber/10 px-4 py-2 text-sm text-amber" role="status">
        <Info className="size-4 shrink-0" aria-hidden="true" />
        <span>
          <span className="font-semibold">The assistant isn&apos;t set up yet.</span> An administrator needs to add a Groq API key to the
          server.
        </span>
      </div>
    ) : null;

  return (
    <>
      <ConversationHeader
        conversation={conversation}
        onBack={onBack}
        onSearch={onSearch}
        onToggleMute={noop}
        onMarkRead={noop}
        onClear={assistant.clear}
      />
      <ConversationPanel
        controller={assistant.controller}
        focusId={focusId}
        banner={banner}
        interactive={false}
        suggestions={ASSISTANT_SUGGESTIONS}
        placeholder="Ask anything…"
        beginningLabel="The assistant can make mistakes — check anything important."
        emptyTitle="Hi! I'm your TimeFlow Assistant"
        emptyDescription="Ask about your tasks and projects, have me create and assign tasks, translate, or write something. Attach a PDF, Word file or screenshot and I'll read it. I only see and change what you can."
      />
    </>
  );
}
