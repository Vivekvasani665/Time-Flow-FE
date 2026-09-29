"use client";

import { Paperclip, SendHorizontal, Smile } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent, type Ref } from "react";
import { cn } from "@/lib/utils";
import { CHAT_MESSAGE_MAX_LENGTH, type ChatMessageView } from "@/types/chat";
import { ChatReactionPicker, COMPOSER_EMOJI } from "./chat-reaction-picker";
import { ChatReplyPreview } from "./chat-reply-preview";

/** Re-announce "typing" at most this often while keys keep coming. */
const TYPING_REFRESH_MS = 3_000;
/** Silence this long counts as having stopped typing. */
const TYPING_IDLE_MS = 2_500;
const MAX_HEIGHT_PX = 160;
const COUNTER_FROM = CHAT_MESSAGE_MAX_LENGTH - 200;
export const MESSAGE_TOO_LONG = `Your message is too long. Please keep it under ${CHAT_MESSAGE_MAX_LENGTH} characters.`;

type ChatInputProps = {
  replyingTo: ChatMessageView | null;
  editing: ChatMessageView | null;
  onCancelContext: () => void;
  onSend: (content: string) => void;
  onSaveEdit: (message: ChatMessageView, content: string) => Promise<boolean>;
  onTypingStart: () => void;
  onTypingStop: () => void;
  textareaRef?: Ref<HTMLTextAreaElement>;
  /** e.g. "Message #General". */
  placeholder?: string;
  /** Attach button; hidden when absent. */
  onAttach?: () => void;
};

export function ChatInput({
  replyingTo,
  editing,
  onCancelContext,
  onSend,
  onSaveEdit,
  onTypingStart,
  onTypingStop,
  textareaRef,
  placeholder = "Type a message…",
  onAttach,
}: ChatInputProps) {
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const lastTypingAt = useRef(0);
  const idleTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const draftBeforeEdit = useRef("");

  const trimmed = value.trim();
  const tooLong = value.length > CHAT_MESSAGE_MAX_LENGTH;
  const canSubmit = trimmed.length > 0 && !tooLong && !saving;

  const resize = () => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT_PX)}px`;
  };

  const stopTyping = () => {
    clearTimeout(idleTimer.current);
    if (lastTypingAt.current !== 0) onTypingStop();
    lastTypingAt.current = 0;
  };

  // Editing swaps the draft for the message's text, and gives the draft back afterwards.
  useEffect(() => {
    if (editing) {
      draftBeforeEdit.current = value;
      setValue(editing.content);
    } else {
      setValue(draftBeforeEdit.current);
      draftBeforeEdit.current = "";
    }
    inputRef.current?.focus();
    // Only when the edited message changes; `value` is read, not tracked.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  useEffect(() => {
    if (replyingTo) inputRef.current?.focus();
  }, [replyingTo]);

  useEffect(resize, [value]);

  // Leaving the page mid-sentence shouldn't leave "typing…" showing for everyone else.
  useEffect(() => () => stopTyping(), []); // eslint-disable-line react-hooks/exhaustive-deps

  const onChange = (next: string) => {
    setValue(next);
    if (editing) return;
    if (!next.trim()) return stopTyping();
    const now = Date.now();
    if (now - lastTypingAt.current > TYPING_REFRESH_MS) {
      lastTypingAt.current = now;
      onTypingStart();
    }
    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(stopTyping, TYPING_IDLE_MS);
  };

  const submit = async () => {
    if (!canSubmit) return;
    if (editing) {
      if (trimmed === editing.content) return onCancelContext();
      setSaving(true);
      const saved = await onSaveEdit(editing, trimmed);
      setSaving(false);
      if (saved) onCancelContext();
      return;
    }
    stopTyping();
    onSend(trimmed);
    setValue("");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends; Shift+Enter is a new line; never interrupt an IME composition.
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void submit();
    } else if (e.key === "Escape" && (editing || replyingTo)) {
      e.preventDefault();
      onCancelContext();
    }
  };

  const insertEmoji = (emoji: string) => {
    const el = inputRef.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    onChange(value.slice(0, start) + emoji + value.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  };

  const setRefs = (el: HTMLTextAreaElement | null) => {
    inputRef.current = el;
    if (typeof textareaRef === "function") textareaRef(el);
    else if (textareaRef) textareaRef.current = el;
  };

  return (
    <div className="shrink-0">
      {editing ? (
        <ChatReplyPreview mode="edit" message={editing} onCancel={onCancelContext} />
      ) : replyingTo ? (
        <ChatReplyPreview mode="reply" message={replyingTo} onCancel={onCancelContext} />
      ) : null}

      <form
        className="flex items-end gap-2 border-t border-line bg-panel px-3 py-3 sm:px-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <ChatReactionPicker
          onPick={insertEmoji}
          emojis={COMPOSER_EMOJI}
          label="Insert emoji"
          icon={<Smile className="size-5" />}
          align="start"
          className="mb-0.5 size-9"
        />
        {onAttach && (
          <button
            type="button"
            onClick={onAttach}
            className="mb-0.5 flex size-9 shrink-0 items-center justify-center rounded-md text-ink-mute transition-colors hover:bg-panel-3 hover:text-ink"
            aria-label="Attach a file"
            title="Attach a file"
          >
            <Paperclip className="size-5" />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <label htmlFor="chat-input" className="sr-only">
            {placeholder}
          </label>
          <textarea
            id="chat-input"
            ref={setRefs}
            value={value}
            rows={1}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            onBlur={stopTyping}
            placeholder={editing ? "Edit your message…" : placeholder}
            aria-invalid={tooLong || undefined}
            aria-describedby={tooLong ? "chat-input-error" : undefined}
            enterKeyHint="send"
            className="field-input block max-h-40 min-h-10 resize-none py-2 text-base leading-6 sm:text-[0.9375rem]"
          />
          {(tooLong || value.length > COUNTER_FROM) && (
            <div className="mt-1 flex items-center justify-between gap-2 text-xs">
              <span id="chat-input-error" className="text-danger" role={tooLong ? "alert" : undefined}>
                {tooLong ? MESSAGE_TOO_LONG : ""}
              </span>
              <span className={cn("tabular", tooLong ? "text-danger" : "text-ink-mute")}>
                {value.length}/{CHAT_MESSAGE_MAX_LENGTH}
              </span>
            </div>
          )}
        </div>
        <button
          type="submit"
          disabled={!canSubmit}
          aria-label={editing ? "Save edit" : "Send message"}
          title={editing ? "Save (Enter)" : "Send (Enter)"}
          className="mb-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-cyan text-white shadow-sm transition-colors hover:bg-cyan-deep disabled:pointer-events-none disabled:opacity-40 [:root[data-theme=dark]_&]:text-void"
        >
          <SendHorizontal className="size-4" />
        </button>
      </form>
    </div>
  );
}
