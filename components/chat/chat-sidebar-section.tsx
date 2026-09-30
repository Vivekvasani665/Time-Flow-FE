"use client";

import { ChevronDown, Plus } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type ChatSidebarSectionProps = {
  title: string;
  /** "+" beside the title, e.g. "Create channel". */
  addLabel?: string;
  onAdd?: () => void;
  /** Shown while collapsed, so unread activity isn't hidden. */
  unread?: number;
  children: ReactNode;
};

export function ChatSidebarSection({ title, addLabel, onAdd, unread = 0, children }: ChatSidebarSectionProps) {
  const [open, setOpen] = useState(true);
  const listId = useId();

  return (
    <section className="mt-3">
      <div className="group flex h-7 items-center gap-1 px-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={listId}
          className="flex min-w-0 flex-1 items-center gap-1 rounded text-left"
        >
          <ChevronDown className={cn("size-3.5 shrink-0 text-ink-mute transition-transform", !open && "-rotate-90")} aria-hidden="true" />
          <span className="eyebrow truncate">{title}</span>
          {!open && unread > 0 && (
            <span className="tabular ml-1 rounded-full bg-cyan/15 px-1.5 text-[0.625rem] font-semibold text-cyan">{unread}</span>
          )}
        </button>
        {onAdd && (
          <button
            type="button"
            onClick={onAdd}
            aria-label={addLabel}
            title={addLabel}
            className="flex size-6 items-center justify-center rounded text-ink-mute hover:bg-panel-3 hover:text-ink"
          >
            <Plus className="size-4" />
          </button>
        )}
      </div>
      <ul id={listId} hidden={!open} className="mt-0.5 space-y-px">
        {children}
      </ul>
    </section>
  );
}
