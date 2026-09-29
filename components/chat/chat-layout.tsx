"use client";

import { LogIn, WifiOff } from "lucide-react";
import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { usePermissions } from "@/components/auth/auth-provider";
import { buttonClasses } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { CHAT_PATH, useChat } from "@/hooks/use-chat";
import { cn } from "@/lib/utils";
import type { ChatMessageView } from "@/types/chat";
import { ChatEmptyState } from "./chat-empty-state";
import { ChatHeader } from "./chat-header";
import { ChatInput } from "./chat-input";
import { ChatMessageList } from "./chat-message-list";
import { ChatTypingIndicator } from "./chat-typing-indicator";

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

export function ChatLayout() {
  const chat = useChat();
  const { can } = usePermissions();
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
    (content: string) => {
      sendMessage(content, replyingTo);
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
    <div className="hud-panel clip-corner flex h-[calc(100dvh-7rem)] min-h-[26rem] flex-col lg:h-[calc(100dvh-8rem)]">
      <ChatHeader online={chat.online} connection={chat.connection} me={chat.me} />

      {chat.connection === "reconnecting" && (
        <div className="flex items-center gap-2 border-b border-amber/25 bg-amber/10 px-4 py-2 text-sm text-amber sm:px-5" role="status">
          <WifiOff className="size-4 shrink-0" aria-hidden="true" />
          <span>
            <span className="font-semibold">Connection lost.</span> We&apos;re trying to reconnect — messages you send will still go through.
          </span>
        </div>
      )}
      {chat.connection === "unauthorized" && (
        <div className="flex flex-wrap items-center gap-2 border-b border-danger/25 bg-danger/10 px-4 py-2 text-sm text-danger sm:px-5" role="alert">
          <LogIn className="size-4 shrink-0" aria-hidden="true" />
          <span className="flex-1">Your session has expired. Please sign in again to continue chatting.</span>
          <Link href={`/login?next=${encodeURIComponent(CHAT_PATH)}`} className={buttonClasses("secondary", "sm")}>
            Sign in
          </Link>
        </div>
      )}

      {chat.status === "loading" ? (
        <MessagesSkeleton />
      ) : chat.status === "error" ? (
        <ErrorState className="flex-1" error={chat.loadError} title="Couldn't load the chat" onRetry={chat.retryLoad} />
      ) : (
        <ChatMessageList
          messages={chat.messages}
          me={chat.me}
          canModerate={can("chat.moderate")}
          hasMore={chat.hasMore}
          loadingOlder={chat.loadingOlder}
          onLoadOlder={chat.loadOlder}
          onReply={onReply}
          onEdit={onEdit}
          onDelete={setPendingDelete}
          onReact={chat.toggleReaction}
          onRetry={chat.retryMessage}
          onDiscard={chat.discardMessage}
          empty={<ChatEmptyState onStart={() => inputRef.current?.focus()} />}
        />
      )}

      <ChatTypingIndicator users={chat.typingUsers} />
      <ChatInput
        textareaRef={inputRef}
        replyingTo={replyingTo}
        editing={editing}
        onCancelContext={cancelContext}
        onSend={onSend}
        onSaveEdit={onSaveEdit}
        onTypingStart={chat.startTyping}
        onTypingStop={chat.stopTyping}
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Delete this message?"
        description={
          pendingDelete && pendingDelete.sender.id !== chat.me
            ? "It will be removed for everyone in Global Chat. This can't be undone."
            : "It will be replaced with “This message was deleted.” for everyone. This can't be undone."
        }
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
