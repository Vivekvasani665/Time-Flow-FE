"use client";

import { Search } from "lucide-react";
import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Dialog } from "@/components/ui/dialog";
import { fullName } from "@/lib/utils";
import type { ChatContact } from "@/types/chat";
import { PresenceDot, PRESENCE_LABEL } from "./presence-dot";

type NewChatDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contacts: ChatContact[];
  onSelect: (contact: ChatContact) => void;
};

const ORDER = { online: 0, away: 1, offline: 2 } as const;

export function NewChatDialog({ open, onOpenChange, contacts, onSelect }: NewChatDialogProps) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const matches = contacts
    .filter((c) => fullName(c).toLowerCase().includes(q))
    .sort((a, b) => ORDER[a.presence] - ORDER[b.presence] || a.firstName.localeCompare(b.firstName));

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setQuery("");
        onOpenChange(next);
      }}
      title="Start a new chat"
      description="Send a private message to someone on your team."
      className="max-w-md"
    >
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-mute" aria-hidden="true" />
        <label htmlFor="new-chat-search" className="sr-only">
          Search people
        </label>
        <input
          id="new-chat-search"
          type="search"
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            // Enter opens the top match, so keyboard users can go straight from typing to chatting.
            if (e.key === "Enter" && matches[0]) {
              e.preventDefault();
              onSelect(matches[0]);
              setQuery("");
            }
          }}
          placeholder="Search people…"
          autoComplete="off"
          className="field-input h-10 pl-9"
        />
      </div>

      <ul className="-mx-2 mt-3 max-h-80 overflow-y-auto" aria-label="People">
        {matches.length === 0 ? (
          <li className="px-2 py-8 text-center text-sm text-ink-mute">Nobody matches “{query.trim()}”.</li>
        ) : (
          matches.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => {
                  onSelect(c);
                  setQuery("");
                }}
                className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-panel-3 focus-visible:bg-panel-3"
              >
                <span className="relative shrink-0">
                  <Avatar user={c} size="sm" />
                  <PresenceDot presence={c.presence} className="absolute -right-0.5 -bottom-0.5" decorative />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink">{fullName(c)}</span>
                  <span className="block text-xs text-ink-mute">{PRESENCE_LABEL[c.presence]}</span>
                </span>
              </button>
            </li>
          ))
        )}
      </ul>
    </Dialog>
  );
}
