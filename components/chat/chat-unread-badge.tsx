"use client";

import { useChatUnread } from "@/hooks/use-chat";
import { cn } from "@/lib/utils";

/** Sidebar count of Global Chat messages the user hasn't seen. Renders nothing at zero. */
export function ChatUnreadBadge({ variant = "count", className }: { variant?: "count" | "dot"; className?: string }) {
  const unread = useChatUnread();
  if (unread === 0) return null;
  const label = `${unread >= 100 ? "99+" : unread} unread ${unread === 1 ? "message" : "messages"}`;

  if (variant === "dot") {
    return (
      <span className={cn("absolute -top-1 -right-1 size-2.5 rounded-full bg-danger ring-2 ring-[#161d45]", className)}>
        <span className="sr-only">{label}</span>
      </span>
    );
  }
  return (
    <span
      className={cn(
        "tabular flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1.5 text-[0.6875rem] font-semibold text-white",
        className,
      )}
    >
      <span aria-hidden="true">{unread >= 100 ? "99+" : unread}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}
