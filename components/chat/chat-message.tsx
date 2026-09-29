"use client";

import { AlertCircle, Check, Clock, CornerUpLeft, MoreHorizontal, Pencil, RotateCcw, Trash2, X } from "lucide-react";
import { memo, type ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn, formatDateTime, fullName } from "@/lib/utils";
import { CHAT_REACTIONS, type ChatMessageView } from "@/types/chat";
import { ChatReactionPicker, chatIconButton } from "./chat-reaction-picker";

const timeFmt = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });

// Only http(s) links become anchors, so a `javascript:` URL stays inert text.
const URL_PATTERN = /(https?:\/\/[^\s<]+[^\s<.,:;"')\]!?])/g;

/** Message text as React nodes — escaped by React, never injected as HTML. */
function linkify(text: string): ReactNode[] {
  return text.split(URL_PATTERN).map((part, i) =>
    i % 2 === 1 ? (
      <a key={i} href={part} target="_blank" rel="noopener noreferrer nofollow" className="underline underline-offset-2 break-all">
        {part}
      </a>
    ) : (
      part
    ),
  );
}

export type ChatMessageHandlers = {
  onReply: (message: ChatMessageView) => void;
  onEdit: (message: ChatMessageView) => void;
  onDelete: (message: ChatMessageView) => void;
  onReact: (message: ChatMessageView, emoji: string) => void;
  onRetry: (clientId: string) => void;
  onDiscard: (clientId: string) => void;
  onJumpTo: (messageId: string) => void;
};

type ChatMessageProps = ChatMessageHandlers & {
  message: ChatMessageView;
  me: string | null;
  canModerate: boolean;
  /** First of a run from the same person: shows their avatar and name. */
  startsGroup: boolean;
  /** Last of a run: shows the time. */
  endsGroup: boolean;
  highlighted: boolean;
};

export const ChatMessage = memo(function ChatMessage({
  message,
  me,
  canModerate,
  startsGroup,
  endsGroup,
  highlighted,
  onReply,
  onEdit,
  onDelete,
  onReact,
  onRetry,
  onDiscard,
  onJumpTo,
}: ChatMessageProps) {
  const mine = message.sender.id === me;
  const deleted = message.deletedAt !== null;
  const pending = message.status !== undefined;
  const actionable = !deleted && !pending;
  const canEdit = actionable && mine;
  const canDelete = actionable && (mine || canModerate);
  const time = timeFmt.format(new Date(message.createdAt));
  const showMeta = endsGroup || pending || (message.editedAt !== null && !deleted);

  return (
    <div
      id={`chat-message-${message.id}`}
      className={cn(
        "group flex gap-2.5 rounded-lg px-4 transition-colors duration-700 sm:px-5",
        startsGroup ? "mt-3" : "mt-0.5",
        mine && "flex-row-reverse",
        highlighted && "bg-cyan/10",
      )}
    >
      {!mine && <div className="w-8 shrink-0 pt-5">{startsGroup && <Avatar user={message.sender} size="sm" />}</div>}

      <div className={cn("flex min-w-0 max-w-[85%] flex-col sm:max-w-[70%]", mine ? "items-end" : "items-start")}>
        {startsGroup && !mine && <p className="mb-1 truncate text-xs font-semibold text-ink-dim">{fullName(message.sender)}</p>}

        <div className={cn("flex max-w-full items-center gap-1", mine && "flex-row-reverse")}>
          <div
            className={cn(
              "min-w-0 rounded-2xl px-3.5 py-2 text-[0.9375rem] leading-relaxed",
              deleted
                ? "border border-dashed border-line-bright text-ink-mute italic"
                : mine
                  ? "bg-cyan text-white [:root[data-theme=dark]_&]:text-void"
                  : "bg-panel-3 text-ink",
              startsGroup && !deleted && (mine ? "rounded-tr-md" : "rounded-tl-md"),
              message.status === "failed" && "opacity-70",
            )}
          >
            {deleted ? (
              <p>This message was deleted.</p>
            ) : (
              <>
                {message.replyTo && (
                  <button
                    type="button"
                    onClick={() => onJumpTo(message.replyTo!.id)}
                    className={cn(
                      "mb-1.5 block w-full min-w-0 rounded-lg border-l-2 px-2.5 py-1 text-left text-xs",
                      mine ? "border-white/70 bg-white/15" : "border-cyan/60 bg-panel",
                    )}
                    aria-label={`Replying to ${fullName(message.replyTo.sender)}. Show original message`}
                  >
                    <span className="block font-semibold">{fullName(message.replyTo.sender)}</span>
                    <span className={cn("line-clamp-2", message.replyTo.deleted && "italic opacity-80")}>
                      {message.replyTo.deleted ? "This message was deleted." : message.replyTo.content}
                    </span>
                  </button>
                )}
                <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{linkify(message.content)}</p>
              </>
            )}
          </div>

          {actionable && (
            <MessageActions
              message={message}
              mine={mine}
              canEdit={canEdit}
              canDelete={canDelete}
              onReply={onReply}
              onEdit={onEdit}
              onDelete={onDelete}
              onReact={onReact}
            />
          )}
        </div>

        {message.reactions.length > 0 && (
          <div className={cn("mt-1 flex flex-wrap gap-1", mine && "justify-end")}>
            {message.reactions.map((r) => {
              const reacted = me !== null && r.userIds.includes(me);
              return (
                <button
                  key={r.emoji}
                  type="button"
                  onClick={() => onReact(message, r.emoji)}
                  aria-pressed={reacted}
                  aria-label={`${r.emoji} ${r.count} ${r.count === 1 ? "reaction" : "reactions"}${reacted ? ", including yours. Remove yours" : ". Add yours"}`}
                  className={cn(
                    "tabular inline-flex h-6 items-center gap-1 rounded-full border px-2 text-xs font-medium transition-colors",
                    reacted ? "border-cyan/40 bg-cyan/10 text-cyan" : "border-line bg-panel text-ink-dim hover:border-line-bright",
                  )}
                >
                  <span className="text-sm leading-none">{r.emoji}</span>
                  {r.count}
                </button>
              );
            })}
          </div>
        )}

        {showMeta && (
          <div className={cn("mt-1 flex flex-wrap items-center gap-x-1.5 text-[0.6875rem] text-ink-mute", mine && "justify-end")}>
            <time dateTime={message.createdAt} title={formatDateTime(message.createdAt)} className="tabular">
              {time}
            </time>
            {message.editedAt && !deleted && <span>· edited</span>}
            {mine && <DeliveryStatus message={message} onRetry={onRetry} onDiscard={onDiscard} />}
          </div>
        )}
      </div>
    </div>
  );
});

function DeliveryStatus({ message, onRetry, onDiscard }: Pick<ChatMessageProps, "message" | "onRetry" | "onDiscard">) {
  if (message.status === "sending") {
    return (
      <span className="inline-flex items-center gap-1">
        · <Clock className="size-3" aria-hidden="true" /> Sending…
      </span>
    );
  }
  if (message.status === "failed") {
    return (
      <span className="inline-flex flex-wrap items-center gap-1.5 text-danger" role="alert">
        · <AlertCircle className="size-3" aria-hidden="true" />
        <span title={message.error}>Failed to send</span>
        <button type="button" onClick={() => onRetry(message.id)} className="inline-flex items-center gap-0.5 font-semibold hover:underline">
          <RotateCcw className="size-3" aria-hidden="true" /> Retry
        </button>
        <button type="button" onClick={() => onDiscard(message.id)} className="inline-flex items-center gap-0.5 hover:underline">
          <X className="size-3" aria-hidden="true" /> Discard
        </button>
      </span>
    );
  }
  if (message.deletedAt) return null;
  return (
    <span className="inline-flex items-center gap-0.5" aria-label="Sent">
      · <Check className="size-3" aria-hidden="true" />
    </span>
  );
}

type MessageActionsProps = Pick<ChatMessageProps, "message" | "onReply" | "onEdit" | "onDelete" | "onReact"> & {
  mine: boolean;
  canEdit: boolean;
  canDelete: boolean;
};

/**
 * Inline buttons on devices that hover; a single "more" menu on touch screens,
 * where hover never happens and a row of icons on every message would crowd it.
 */
function MessageActions({ message, mine, canEdit, canDelete, onReply, onEdit, onDelete, onReact }: MessageActionsProps) {
  return (
    <>
      <div
        className={cn(
          "hidden shrink-0 items-center rounded-lg border border-line bg-panel shadow-sm [@media(hover:hover)]:flex",
          "opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 has-[[data-state=open]]:opacity-100",
        )}
      >
        <ChatReactionPicker onPick={(emoji) => onReact(message, emoji)} align={mine ? "end" : "start"} />
        <button type="button" className={chatIconButton} onClick={() => onReply(message)} aria-label="Reply" title="Reply">
          <CornerUpLeft className="size-4" />
        </button>
        {canEdit && (
          <button type="button" className={chatIconButton} onClick={() => onEdit(message)} aria-label="Edit message" title="Edit">
            <Pencil className="size-4" />
          </button>
        )}
        {canDelete && (
          <button
            type="button"
            className={cn(chatIconButton, "hover:text-danger")}
            onClick={() => onDelete(message)}
            aria-label="Delete message"
            title="Delete"
          >
            <Trash2 className="size-4" />
          </button>
        )}
      </div>

      <DropdownMenu modal={false}>
        <DropdownMenuTrigger className={cn(chatIconButton, "shrink-0 [@media(hover:hover)]:hidden")} aria-label="Message actions">
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align={mine ? "end" : "start"} className="w-52">
          <div className="flex justify-between px-1 py-1">
            {CHAT_REACTIONS.map((emoji) => (
              <DropdownMenuItem key={emoji} onSelect={() => onReact(message, emoji)} aria-label={`React with ${emoji}`} className="size-8 justify-center p-0 text-lg">
                {emoji}
              </DropdownMenuItem>
            ))}
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem icon={<CornerUpLeft />} onSelect={() => onReply(message)}>
            Reply
          </DropdownMenuItem>
          {canEdit && (
            <DropdownMenuItem icon={<Pencil />} onSelect={() => onEdit(message)}>
              Edit
            </DropdownMenuItem>
          )}
          {canDelete && (
            <DropdownMenuItem icon={<Trash2 />} destructive onSelect={() => onDelete(message)}>
              Delete
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
