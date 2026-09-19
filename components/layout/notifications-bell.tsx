"use client";

import { Bell, CheckCheck } from "lucide-react";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from "@/hooks/use-notifications";
import { cn, timeAgo } from "@/lib/utils";

export function NotificationsBell() {
  const { data, isLoading } = useNotifications(true);
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const unread = data?.unread ?? 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="relative flex size-9 items-center justify-center rounded-lg text-ink-dim transition hover:bg-panel-3 hover:text-ink data-[state=open]:bg-panel-3 data-[state=open]:text-ink"
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
      >
        <Bell className="size-[18px]" />
        {unread > 0 && (
          <span className="tabular absolute top-0.5 right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[0.625rem] font-semibold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[min(22rem,calc(100vw-2rem))] p-0">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <p className="text-sm font-semibold text-ink">Notifications</p>
          <button
            type="button"
            onClick={() => markAll.mutate()}
            disabled={unread === 0 || markAll.isPending}
            className="flex items-center gap-1 text-xs font-medium text-cyan hover:underline disabled:opacity-40"
          >
            <CheckCheck className="size-3.5" /> Mark all read
          </button>
        </div>
        <div className="max-h-96 overflow-y-auto p-1">
          {isLoading ? (
            <div className="flex justify-center py-8 text-ink-mute">
              <Spinner />
            </div>
          ) : !data || data.items.length === 0 ? (
            <p className="py-10 text-center text-sm text-ink-mute">You&apos;re all caught up.</p>
          ) : (
            data.items.map((n) => (
              <DropdownMenuItem
                key={n.id}
                asChild
                onSelect={() => {
                  if (!n.readAt) markRead.mutate(n.id);
                }}
                className="items-start"
              >
                <Link href={n.link ?? "#"} className="flex gap-3 py-2.5">
                  <span
                    className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-cyan")}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1">
                    <span className={cn("block text-sm", n.readAt ? "text-ink-dim" : "text-ink")}>{n.title}</span>
                    {n.body && <span className="block truncate text-xs font-normal text-ink-mute">{n.body}</span>}
                    <span className="tabular mt-0.5 block text-[0.65rem] text-ink-mute">{timeAgo(n.createdAt)}</span>
                  </span>
                </Link>
              </DropdownMenuItem>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
