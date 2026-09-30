"use client";

import { typingLabel } from "@/lib/chat-state";
import type { ChatUser } from "@/types/chat";

/**
 * Always takes its line, so the composer doesn't jump when someone starts typing.
 * `label` replaces the "… is typing" wording, e.g. "TimeFlow Assistant · Looking up tasks…". */
export function ChatTypingIndicator({ users, label: override }: { users: ChatUser[]; label?: string }) {
  const label = users.length === 0 ? "" : (override ?? typingLabel(users.map((u) => u.firstName)));
  return (
    <div className="flex h-6 items-center gap-2 px-4 text-xs text-ink-mute sm:px-5" aria-live="polite">
      {label && (
        <>
          <span className="flex gap-0.5" aria-hidden="true">
            {[0, 150, 300].map((delay) => (
              <span
                key={delay}
                className="size-1.5 rounded-full bg-ink-mute motion-safe:animate-bounce"
                style={{ animationDelay: `${delay}ms` }}
              />
            ))}
          </span>
          <span className="truncate">{label}</span>
        </>
      )}
    </div>
  );
}
