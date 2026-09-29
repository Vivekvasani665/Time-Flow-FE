"use client";

import { Bell, BellOff, CheckCheck, ChevronLeft, Hash, Lock, MoreVertical, Search } from "lucide-react";
import type { ReactNode } from "react";
import { Avatar, AvatarStack } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn, fullName } from "@/lib/utils";
import type { ChatConnectionState, ChatConversation, ChatUser } from "@/types/chat";
import { chatIconButton } from "./chat-reaction-picker";
import { PresenceDot, PRESENCE_LABEL } from "./presence-dot";

type ConversationHeaderProps = {
  conversation: ChatConversation;
  /** Back to the conversation list (small screens). */
  onBack: () => void;
  onSearch: () => void;
  onToggleMute: () => void;
  onMarkRead: () => void;
  /** Extra controls on the right, e.g. who's online in a live channel. */
  children?: ReactNode;
};

export function ConversationHeader({ conversation, onBack, onSearch, onToggleMute, onMarkRead, children }: ConversationHeaderProps) {
  const { contact } = conversation;
  const ChannelIcon = conversation.visibility === "private" ? Lock : Hash;

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b border-line px-2 sm:gap-3 sm:px-4">
      <button type="button" onClick={onBack} className={cn(chatIconButton, "size-9 md:hidden")} aria-label="Back to chats" title="Back to chats">
        <ChevronLeft className="size-5" />
      </button>

      {contact ? (
        <span className="relative shrink-0">
          <Avatar user={contact} size="sm" />
          <PresenceDot presence={contact.presence} className="absolute -right-0.5 -bottom-0.5" decorative />
        </span>
      ) : (
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-panel-3 text-ink-dim" aria-hidden="true">
          <ChannelIcon className="size-4" />
        </span>
      )}

      <div className="min-w-0 flex-1">
        <h2 className="flex items-center gap-1.5 truncate text-[0.9375rem] font-semibold text-ink">
          <span className="truncate">{conversation.name}</span>
          {conversation.muted && <BellOff className="size-3.5 shrink-0 text-ink-mute" aria-label="Muted" />}
        </h2>
        <p className="truncate text-xs text-ink-mute">
          {contact ? PRESENCE_LABEL[contact.presence] : (conversation.description ?? (conversation.visibility === "private" ? "Private channel" : "Public channel"))}
        </p>
      </div>

      {children}

      <button type="button" onClick={onSearch} className={chatIconButton} aria-label="Search messages" title="Search">
        <Search className="size-4" />
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger className={chatIconButton} aria-label="Conversation options" title="Options">
          <MoreVertical className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem icon={<CheckCheck />} onSelect={onMarkRead} disabled={conversation.unread === 0}>
            Mark as read
          </DropdownMenuItem>
          <DropdownMenuItem icon={conversation.muted ? <Bell /> : <BellOff />} onSelect={onToggleMute}>
            {conversation.muted ? "Unmute" : "Mute"} {conversation.kind === "channel" ? "channel" : "conversation"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}

const CONNECTION: Record<ChatConnectionState, { label: string; dot: string; text: string }> = {
  connected: { label: "Connected", dot: "bg-lime", text: "text-lime" },
  connecting: { label: "Connecting…", dot: "bg-amber motion-safe:animate-pulse", text: "text-amber" },
  reconnecting: { label: "Reconnecting…", dot: "bg-danger motion-safe:animate-pulse", text: "text-danger" },
  unauthorized: { label: "Signed out", dot: "bg-danger", text: "text-danger" },
};

/** Live channels: connection state and who's online right now. */
export function LivePresence({ online, connection, me }: { online: ChatUser[]; connection: ChatConnectionState; me: string | null }) {
  const status = CONNECTION[connection];
  return (
    <>
      <span className={cn("hidden items-center gap-1.5 text-xs font-medium lg:inline-flex", status.text)} role="status">
        <span className={cn("size-2 rounded-full", status.dot)} aria-hidden="true" />
        {status.label}
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="flex h-8 items-center gap-2 rounded-lg border border-line px-2 text-xs text-ink-dim transition hover:bg-panel-3 hover:text-ink data-[state=open]:bg-panel-3"
          aria-label={`${online.length} online. Show who is online`}
          title="Who's online"
        >
          <span className="hidden xl:block">
            <AvatarStack users={online} max={3} />
          </span>
          <span className={cn("size-2 rounded-full", connection === "connected" ? "bg-lime" : status.dot)} aria-hidden="true" />
          <span className="tabular font-medium">{online.length}</span>
          <span className="hidden sm:inline">online</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-64 p-1">
          <DropdownMenuLabel>Online now</DropdownMenuLabel>
          {online.length === 0 ? (
            <p className="px-2 py-3 text-sm text-ink-mute">
              {connection === "connected" ? "Nobody else is here right now." : "Waiting for the connection…"}
            </p>
          ) : (
            <ul className="max-h-72 overflow-y-auto">
              {online.map((u) => (
                <li key={u.id} className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-ink">
                  <span className="relative">
                    <Avatar user={u} size="xs" />
                    <PresenceDot presence="online" className="absolute -right-0.5 -bottom-0.5" />
                  </span>
                  <span className="truncate">
                    {fullName(u)}
                    {u.id === me && <span className="text-ink-mute"> (you)</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
