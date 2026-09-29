"use client";

import { SmilePlus } from "lucide-react";
import type { ReactNode } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { CHAT_REACTIONS } from "@/types/chat";

/** Emoji offered by the composer's insert picker; reactions are limited to {@link CHAT_REACTIONS}. */
export const COMPOSER_EMOJI = [
  "😀", "😂", "😊", "😍", "🤔", "😎", "😢", "😮",
  "👍", "👎", "👏", "🙏", "💪", "👋", "🙌", "🤝",
  "❤️", "🔥", "🎉", "✅", "🚀", "💡", "⏰", "☕",
];

export const chatIconButton =
  "flex size-8 items-center justify-center rounded-md text-ink-mute transition-colors hover:bg-panel-3 hover:text-ink data-[state=open]:bg-panel-3 data-[state=open]:text-ink";

type ChatReactionPickerProps = {
  onPick: (emoji: string) => void;
  emojis?: readonly string[];
  label?: string;
  icon?: ReactNode;
  className?: string;
  align?: "start" | "center" | "end";
  side?: "top" | "bottom";
};

export function ChatReactionPicker({
  onPick,
  emojis = CHAT_REACTIONS,
  label = "Add reaction",
  icon,
  className,
  align = "center",
  side = "top",
}: ChatReactionPickerProps) {
  const grid = emojis.length > 8;
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger aria-label={label} title={label} className={cn(chatIconButton, className)}>
        {icon ?? <SmilePlus className="size-4" />}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} side={side} className="min-w-0 p-1.5">
        <div className={cn(grid ? "grid grid-cols-8 gap-0.5" : "flex gap-0.5")} aria-label={label}>
          {emojis.map((emoji) => (
            <DropdownMenuItem
              key={emoji}
              onSelect={() => onPick(emoji)}
              aria-label={emoji}
              className="size-9 justify-center p-0 text-xl leading-none"
            >
              {emoji}
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
