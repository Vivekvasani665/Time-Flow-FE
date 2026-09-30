"use client";

import { FileText, ImageIcon, Loader2, Paperclip, SendHorizontal, Smile, Square, X } from "lucide-react";
import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent, type Ref } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { CHAT_MESSAGE_MAX_LENGTH, type AssistantAttachment, type ChatMessageView } from "@/types/chat";
import { ChatReactionPicker, COMPOSER_EMOJI } from "./chat-reaction-picker";
import { ChatReplyPreview } from "./chat-reply-preview";

/** Re-announce "typing" at most this often while keys keep coming. */
const TYPING_REFRESH_MS = 3_000;
/** Silence this long counts as having stopped typing. */
const TYPING_IDLE_MS = 2_500;
const MAX_HEIGHT_PX = 160;
const COUNTER_FROM = CHAT_MESSAGE_MAX_LENGTH - 200;
export const MESSAGE_TOO_LONG = `Your message is too long. Please keep it under ${CHAT_MESSAGE_MAX_LENGTH} characters.`;

/** Lets the composer send files (the assistant). */
export type AttachSupport = {
  /** For the file picker, e.g. "image/png,.pdf". */
  accept: string;
  /** Files per message. */
  max: number;
  /** Reads or resizes a picked file; rejects with a message for the user. */
  prepare: (file: File) => Promise<AssistantAttachment>;
};

type PendingFile = { id: string; name: string; image: boolean; ready: AssistantAttachment | null };

type ChatInputProps = {
  replyingTo: ChatMessageView | null;
  editing: ChatMessageView | null;
  onCancelContext: () => void;
  onSend: (content: string, attachments?: AssistantAttachment[]) => void;
  onSaveEdit: (message: ChatMessageView, content: string) => Promise<boolean>;
  onTypingStart: () => void;
  onTypingStop: () => void;
  textareaRef?: Ref<HTMLTextAreaElement>;
  /** e.g. "Message #General". */
  placeholder?: string;
  /** Attach button; hidden when absent. Ignored when `attach` is set. */
  onAttach?: () => void;
  /** Real file attachments; the attach button opens a file picker and images can be pasted. */
  attach?: AttachSupport;
  /** While set, the send button becomes Stop (e.g. the assistant is answering). */
  onStop?: () => void;
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
  attach,
  onStop,
}: ChatInputProps) {
  const [files, setFiles] = useState<PendingFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const lastTypingAt = useRef(0);
  const idleTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const draftBeforeEdit = useRef("");

  const trimmed = value.trim();
  const tooLong = value.length > CHAT_MESSAGE_MAX_LENGTH;
  const preparing = files.some((f) => f.ready === null);
  const readyFiles = files.flatMap((f) => (f.ready ? [f.ready] : []));
  const canSubmit = (trimmed.length > 0 || (!editing && readyFiles.length > 0)) && !tooLong && !saving && !preparing;

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
    onSend(trimmed, readyFiles.length ? readyFiles : undefined);
    setValue("");
    setFiles([]);
  };

  const addFiles = (picked: File[]) => {
    if (!attach || picked.length === 0) return;
    const room = attach.max - files.length;
    if (picked.length > room) toast.error(`You can attach up to ${attach.max} files to one message.`);
    for (const file of picked.slice(0, Math.max(0, room))) {
      const id = crypto.randomUUID();
      setFiles((prev) => [...prev, { id, name: file.name, image: file.type.startsWith("image/"), ready: null }]);
      attach.prepare(file).then(
        (ready) => setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, ready } : f))),
        (error: unknown) => {
          setFiles((prev) => prev.filter((f) => f.id !== id));
          toast.error("Couldn't attach the file", { description: error instanceof Error ? error.message : file.name });
        },
      );
    }
    inputRef.current?.focus();
  };

  // Pasting a screenshot attaches it; pasted text is left to the textarea.
  const onPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    if (!attach || editing) return;
    const pasted = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith("image/"));
    if (pasted.length === 0) return;
    e.preventDefault();
    addFiles(pasted);
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

      {files.length > 0 && !editing && (
        <ul className="flex flex-wrap gap-2 border-t border-line bg-panel px-3 pt-3 sm:px-4" aria-label="Attached files">
          {files.map((f) => (
            <li
              key={f.id}
              className="flex max-w-60 items-center gap-2 rounded-lg border border-line-bright bg-panel-3 py-1 pr-1 pl-1.5 text-sm text-ink"
            >
              {f.ready?.kind === "image" && f.ready.dataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- a local data URL, nothing to optimise
                <img src={f.ready.dataUrl} alt="" className="size-8 shrink-0 rounded object-cover" />
              ) : (
                <span className="flex size-8 shrink-0 items-center justify-center rounded bg-panel text-ink-mute" aria-hidden="true">
                  {f.ready === null ? <Loader2 className="size-4 animate-spin" /> : f.image ? <ImageIcon className="size-4" /> : <FileText className="size-4" />}
                </span>
              )}
              <span className="min-w-0 truncate" title={f.name}>
                {f.name}
                {f.ready === null && <span className="sr-only"> (preparing)</span>}
              </span>
              <button
                type="button"
                onClick={() => setFiles((prev) => prev.filter((p) => p.id !== f.id))}
                className="flex size-6 shrink-0 items-center justify-center rounded text-ink-mute hover:bg-panel hover:text-ink"
                aria-label={`Remove ${f.name}`}
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

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
        {attach && (
          <input
            ref={fileInputRef}
            type="file"
            accept={attach.accept}
            multiple
            hidden
            data-testid="chat-file-input"
            onChange={(e) => {
              addFiles(Array.from(e.target.files ?? []));
              e.target.value = "";
            }}
          />
        )}
        {(attach || onAttach) && (
          <button
            type="button"
            onClick={attach ? () => fileInputRef.current?.click() : onAttach}
            disabled={Boolean(attach && (editing || files.length >= attach.max))}
            className="mb-0.5 flex size-9 shrink-0 items-center justify-center rounded-md text-ink-mute transition-colors hover:bg-panel-3 hover:text-ink disabled:pointer-events-none disabled:opacity-40"
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
            onPaste={onPaste}
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
        {onStop ? (
          <button
            type="button"
            onClick={onStop}
            aria-label="Stop generating"
            title="Stop generating"
            className="mb-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-ink text-panel shadow-sm transition-opacity hover:opacity-85"
          >
            <Square className="size-3.5 fill-current" />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!canSubmit}
            aria-label={editing ? "Save edit" : "Send message"}
            title={editing ? "Save (Enter)" : "Send (Enter)"}
            className="mb-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-cyan text-white shadow-sm transition-colors hover:bg-cyan-deep disabled:pointer-events-none disabled:opacity-40 [:root[data-theme=dark]_&]:text-void"
          >
            <SendHorizontal className="size-4" />
          </button>
        )}
      </form>
    </div>
  );
}
