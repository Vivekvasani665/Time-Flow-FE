"use client";

import { MessagesSquare } from "lucide-react";
import { Avatar, AvatarStack } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn, fullName } from "@/lib/utils";
import type { ChatConnectionState, ChatUser } from "@/types/chat";

const CONNECTION: Record<ChatConnectionState, { label: string; dot: string; text: string }> = {
  connected: { label: "Connected", dot: "bg-lime", text: "text-lime" },
  connecting: { label: "Connecting…", dot: "bg-amber motion-safe:animate-pulse", text: "text-amber" },
  reconnecting: { label: "Reconnecting…", dot: "bg-danger motion-safe:animate-pulse", text: "text-danger" },
  unauthorized: { label: "Signed out", dot: "bg-danger", text: "text-danger" },
};

type ChatHeaderProps = { online: ChatUser[]; connection: ChatConnectionState; me: string | null };

export function ChatHeader({ online, connection, me }: ChatHeaderProps) {
  const status = CONNECTION[connection];
  return (
    <header className="flex items-center gap-3 border-b border-line px-4 py-3 sm:px-5">
      <span className="hidden size-10 shrink-0 items-center justify-center rounded-xl bg-cyan/10 text-cyan sm:flex" aria-hidden="true">
        <MessagesSquare className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-base font-semibold text-ink sm:text-lg">Global Chat</h1>
        <p className="truncate text-xs text-ink-mute sm:text-sm">Everyone in TimeFlow</p>
      </div>

      <span className={cn("hidden items-center gap-1.5 text-xs font-medium sm:inline-flex", status.text)} role="status">
        <span className={cn("size-2 rounded-full", status.dot)} aria-hidden="true" />
        {status.label}
      </span>

      <DropdownMenu>
        <DropdownMenuTrigger
          className="flex items-center gap-2 rounded-lg border border-line px-2 py-1.5 text-sm text-ink-dim transition hover:bg-panel-3 hover:text-ink data-[state=open]:bg-panel-3"
          aria-label={`${online.length} online. Show who is online`}
        >
          <span className="hidden sm:block">
            <AvatarStack users={online} max={3} />
          </span>
          <span className="flex items-center gap-1.5 font-medium">
            <span className={cn("size-2 rounded-full", connection === "connected" ? "bg-lime" : status.dot)} aria-hidden="true" />
            <span className="tabular">{online.length}</span>
            <span>online</span>
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-64 p-1">
          <DropdownMenuLabel>Online now</DropdownMenuLabel>
          {online.length === 0 ? (
            <p className="px-2 py-3 text-sm text-ink-mute">
              {connection === "connected" ? "Nobody else is here right now." : "Waiting for the connection…"}
            </p>
          ) : (
            <ul className="max-h-72 overflow-y-auto">
              {online.map((u) => (
                <li key={u.id} className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-ink">
                  <span className="relative">
                    <Avatar user={u} size="xs" />
                    <span className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2 border-panel bg-lime" aria-hidden="true" />
                  </span>
                  <span className="truncate">
                    {fullName(u)}
                    {u.id === me && <span className="text-ink-mute"> (you)</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
