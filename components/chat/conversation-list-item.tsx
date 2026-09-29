"use client";

import { BellOff, Hash, Lock } from "lucide-react";
import { memo } from "react";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { ChatConversation } from "@/types/chat";
import { PresenceDot } from "./presence-dot";

const timeFmt = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
const dateFmt = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });

function shortTime(iso: string) {
  const d = new Date(iso);
  return d.toDateString() === new Date().toDateString() ? timeFmt.format(d) : dateFmt.format(d);
}

type ConversationListItemProps = {
  conversation: ChatConversation;
  active: boolean;
  onSelect: (id: string) => void;
};

export const ConversationListItem = memo(function ConversationListItem({ conversation, active, onSelect }: ConversationListItemProps) {
  const { contact, unread, muted, lastMessage } = conversation;
  const unreadShown = unread > 0 && !muted;
  const ChannelIcon = conversation.visibility === "private" ? Lock : Hash;
  const label = [conversation.kind === "channel" ? `${conversation.name} channel` : conversation.name, unread > 0 ? `${unread} unread` : null, muted ? "muted" : null]
    .filter(Boolean)
    .join(", ");

  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(conversation.id)}
        aria-current={active ? "page" : undefined}
        aria-label={label}
        className={cn(
          "group flex w-full items-center gap-2.5 rounded-md px-2 text-left transition-colors",
          contact ? "py-1.5" : "h-8",
          active ? "bg-cyan/10 text-ink" : "text-ink-dim hover:bg-panel-3 hover:text-ink",
          muted && !active && "opacity-60",
        )}
      >
        {contact ? (
          <span className="relative shrink-0">
            <Avatar user={contact} size="xs" className="size-7" />
            <PresenceDot presence={contact.presence} className="absolute -right-0.5 -bottom-0.5 size-2.5" />
          </span>
        ) : (
          <ChannelIcon className={cn("size-4 shrink-0", active ? "text-cyan" : "text-ink-mute")} aria-hidden="true" />
        )}

        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className={cn("truncate text-sm", (unreadShown || active) && "font-semibold text-ink")}>
              {contact ? contact.firstName : conversation.name}
              {contact && <span className="hidden font-normal text-ink-mute lg:inline"> {contact.lastName}</span>}
            </span>
            {contact && lastMessage && (
              <span className="tabular ml-auto shrink-0 text-[0.6875rem] font-normal text-ink-mute">{shortTime(lastMessage.createdAt)}</span>
            )}
          </span>
          {contact && lastMessage && (
            <span className={cn("block truncate text-xs", unreadShown ? "text-ink-dim" : "text-ink-mute")}>
              {lastMessage.senderName === "You" && "You: "}
              {lastMessage.content}
            </span>
          )}
        </span>

        {muted ? (
          <BellOff className="size-3.5 shrink-0 text-ink-mute" aria-hidden="true" />
        ) : unreadShown ? (
          <span className="tabular flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-cyan px-1.5 text-[0.6875rem] font-semibold text-white [:root[data-theme=dark]_&]:text-void">
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </button>
    </li>
  );
});
