"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { cn } from "@/lib/utils";
import type { AssistantAttachment, ChatMessageView, ChatUser } from "@/types/chat";
import { Button } from "@/components/ui/button";
import { MessagesSquare } from "lucide-react";
import { ChatInput, type AttachSupport } from "./chat-input";
import { ChatMessageList } from "./chat-message-list";
import { ChatTypingIndicator } from "./chat-typing-indicator";

/**
 * What a conversation needs to be shown and used. `useChat` provides it for
 * the live Global Chat; the workspace provides it for mock conversations — and
 * later for every conversation, from the API.
 */
export type ConversationController = {
  me: string | null;
  messages: ChatMessageView[];
  status: "loading" | "ready" | "error";
  loadError?: unknown;
  retryLoad?: () => unknown;
  hasMore: boolean;
  loadingOlder: boolean;
  loadOlder: () => void;
  typingUsers: ChatUser[];
  /** Replaces "… is typing" (e.g. what the assistant is doing). */
  typingLabel?: string;
  canModerate: boolean;
  sendMessage: (content: string, replyTo: ChatMessageView | null, attachments?: AssistantAttachment[]) => void;
  editMessage: (id: string, content: string) => Promise<boolean>;
  deleteMessage: (id: string) => Promise<boolean>;
  toggleReaction: (message: ChatMessageView, emoji: string) => void;
  retryMessage: (clientId: string) => void;
  discardMessage: (clientId: string) => void;
  startTyping: () => void;
  stopTyping: () => void;
  /** Set while an answer is being written (the assistant): the composer offers Stop instead of Send. */
  onStop?: () => void;
  /** Where files can be sent (the assistant). Elsewhere the attach button says it's coming soon. */
  attach?: AttachSupport;
};

function MessagesSkeleton() {
  return (
    <div className="flex-1 space-y-5 overflow-hidden px-5 py-6" role="status" aria-label="Loading messages">
      {["w-2/3", "w-2/5", "w-3/4", "w-1/2", "w-1/3"].map((width, i) => (
        <div key={width} className={cn("flex items-end gap-2.5", i % 3 === 1 && "flex-row-reverse")}>
          {i % 3 !== 1 && <Skeleton className="size-8 shrink-0 rounded-full" />}
          <Skeleton className={cn("h-10 rounded-2xl", width)} />
        </div>
      ))}
    </div>
  );
}

type ConversationPanelProps = {
  controller: ConversationController;
  /** Composer placeholder, e.g. "Message #General". */
  placeholder: string;
  beginningLabel: string;
  emptyTitle: string;
  emptyDescription: string;
  newSince?: string | null;
  focusId?: string | null;
  /** Status banners (connection lost, signed out) under the header. */
  banner?: ReactNode;
  /** Reply, edit, delete and reactions on messages. Off for the assistant. */
  interactive?: boolean;
  /** Starter questions offered while the conversation is empty. */
  suggestions?: string[];
};

export function ConversationPanel({
  controller: chat,
  placeholder,
  beginningLabel,
  emptyTitle,
  emptyDescription,
  newSince,
  focusId,
  banner,
  interactive = true,
  suggestions,
}: ConversationPanelProps) {
  const [replyingTo, setReplyingTo] = useState<ChatMessageView | null>(null);
  const [editing, setEditing] = useState<ChatMessageView | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ChatMessageView | null>(null);
  const [deleting, setDeleting] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { sendMessage, editMessage, deleteMessage } = chat;

  const onReply = useCallback((message: ChatMessageView) => {
    setEditing(null);
    setReplyingTo(message);
  }, []);
  const onEdit = useCallback((message: ChatMessageView) => {
    setReplyingTo(null);
    setEditing(message);
  }, []);
  const cancelContext = useCallback(() => {
    setReplyingTo(null);
    setEditing(null);
  }, []);
  const onSend = useCallback(
    (content: string, attachments?: AssistantAttachment[]) => {
      sendMessage(content, replyingTo, attachments);
      setReplyingTo(null);
    },
    [sendMessage, replyingTo],
  );
  const onSaveEdit = useCallback((message: ChatMessageView, content: string) => editMessage(message.id, content), [editMessage]);

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    const ok = await deleteMessage(pendingDelete.id);
    setDeleting(false);
    if (!ok) return;
    if (editing?.id === pendingDelete.id || replyingTo?.id === pendingDelete.id) cancelContext();
    setPendingDelete(null);
    toast.success("Message deleted");
  };

  return (
    <>
      {banner}

      {chat.status === "loading" ? (
        <MessagesSkeleton />
      ) : chat.status === "error" ? (
        <ErrorState className="flex-1" error={chat.loadError} title="Couldn't load this conversation" onRetry={chat.retryLoad} />
      ) : (
        <ChatMessageList
          messages={chat.messages}
          me={chat.me}
          canModerate={chat.canModerate}
          hasMore={chat.hasMore}
          loadingOlder={chat.loadingOlder}
          onLoadOlder={chat.loadOlder}
          beginningLabel={beginningLabel}
          newSince={newSince}
          focusId={focusId}
          interactive={interactive}
          onReply={onReply}
          onEdit={onEdit}
          onDelete={setPendingDelete}
          onReact={chat.toggleReaction}
          onRetry={chat.retryMessage}
          onDiscard={chat.discardMessage}
          empty={
            <EmptyState
              className="h-full"
              icon={<MessagesSquare />}
              title={emptyTitle}
              description={emptyDescription}
              action={
                suggestions?.length ? (
                  <div className="flex max-w-md flex-wrap justify-center gap-2">
                    {suggestions.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => sendMessage(s, null)}
                        className="rounded-full border border-line-bright bg-panel px-3 py-1.5 text-sm text-ink-dim transition-colors hover:border-cyan/50 hover:text-ink"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                ) : (
                  <Button size="sm" onClick={() => inputRef.current?.focus()}>
                    Send a message
                  </Button>
                )
              }
            />
          }
        />
      )}

      <ChatTypingIndicator users={chat.typingUsers} label={chat.typingLabel} />
      <ChatInput
        textareaRef={inputRef}
        placeholder={placeholder}
        replyingTo={replyingTo}
        editing={editing}
        onCancelContext={cancelContext}
        onSend={onSend}
        onSaveEdit={onSaveEdit}
        onTypingStart={chat.startTyping}
        onTypingStop={chat.stopTyping}
        onStop={chat.onStop}
        attach={chat.attach}
        onAttach={() => toast("File sharing is coming soon", { description: "You'll be able to attach files to messages here." })}
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Delete this message?"
        description={
          pendingDelete && pendingDelete.sender.id !== chat.me
            ? "It will be removed for everyone in this conversation. This can't be undone."
            : "It will be replaced with “This message was deleted.” for everyone. This can't be undone."
        }
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={() => void confirmDelete()}
      />
    </>
  );
}
