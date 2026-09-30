"use client";

import { CornerUpLeft, Pencil, X } from "lucide-react";
import { fullName } from "@/lib/utils";
import type { ChatMessageView } from "@/types/chat";

type ChatReplyPreviewProps = {
  mode: "reply" | "edit";
  message: ChatMessageView;
  onCancel: () => void;
};

/** The banner above the composer while replying to, or editing, a message. */
export function ChatReplyPreview({ mode, message, onCancel }: ChatReplyPreviewProps) {
  const Icon = mode === "reply" ? CornerUpLeft : Pencil;
  return (
    <div className="flex items-center gap-3 border-t border-line bg-panel-2 px-4 py-2 sm:px-5">
      <Icon className="size-4 shrink-0 text-cyan" aria-hidden="true" />
      <div className="min-w-0 flex-1 border-l-2 border-cyan/60 pl-2.5">
        <p className="text-xs font-semibold text-ink">
          {mode === "reply" ? <>Replying to {fullName(message.sender)}</> : "Editing message"}
        </p>
        <p className="truncate text-xs text-ink-mute">{message.content}</p>
      </div>
      <button
        type="button"
        onClick={onCancel}
        className="flex size-8 shrink-0 items-center justify-center rounded-md text-ink-mute hover:bg-panel-3 hover:text-ink"
        aria-label={mode === "reply" ? "Cancel reply" : "Cancel editing"}
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
