"use client";

import { Hash, MessageSquareText, Search, SquarePen, UserPlus, X } from "lucide-react";
import { useMemo, type Ref } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ChatWorkspace } from "@/hooks/use-chat-workspace";
import { cn } from "@/lib/utils";
import type { ChatContact } from "@/types/chat";
import { chatIconButton } from "./chat-reaction-picker";
import { ChatSearchResults } from "./chat-search-results";
import { ChatSidebarSection } from "./chat-sidebar-section";
import { ConversationListItem } from "./conversation-list-item";

export const THREADS_ID = "threads";

type ChatSidebarProps = {
  workspace: ChatWorkspace;
  selectedId: string | null;
  onSelect: (id: string, messageId?: string) => void;
  onOpenPerson: (contact: ChatContact) => void;
  onNewChat: () => void;
  onNewChannel: () => void;
  query: string;
  onQueryChange: (query: string) => void;
  searchRef: Ref<HTMLInputElement>;
  className?: string;
};

export function ChatSidebar({
  workspace,
  selectedId,
  onSelect,
  onOpenPerson,
  onNewChat,
  onNewChannel,
  query,
  onQueryChange,
  searchRef,
  className,
}: ChatSidebarProps) {
  const channels = workspace.conversations.filter((c) => c.kind === "channel");
  const directs = workspace.conversations.filter((c) => c.kind === "direct");
  const unread = (list: typeof channels) => list.reduce((n, c) => n + (c.muted ? 0 : c.unread), 0);
  const { search } = workspace;
  const results = useMemo(() => (query.trim() ? search(query) : null), [query, search]);

  return (
    <aside className={cn("min-h-0 flex-col bg-panel-2", className)} aria-label="Conversations">
      <div className="flex h-16 shrink-0 items-center gap-2 border-b border-line px-4">
        <h1 className="flex-1 text-base font-semibold text-ink">Chats</h1>
        <DropdownMenu>
          <DropdownMenuTrigger className={cn(chatIconButton, "size-9")} aria-label="New conversation" title="New conversation">
            <SquarePen className="size-[18px]" />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem icon={<UserPlus />} onSelect={onNewChat}>
              New direct message
            </DropdownMenuItem>
            <DropdownMenuItem icon={<Hash />} onSelect={onNewChannel}>
              Create channel
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="shrink-0 px-3 pt-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-ink-mute" aria-hidden="true" />
          <label htmlFor="chat-search" className="sr-only">
            Search people or messages
          </label>
          <input
            id="chat-search"
            ref={searchRef}
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && onQueryChange("")}
            placeholder="Search people or messages…"
            autoComplete="off"
            className="field-input h-9 pr-8 pl-8 text-base sm:text-sm [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button
              type="button"
              onClick={() => onQueryChange("")}
              className="absolute top-1/2 right-1.5 flex size-6 -translate-y-1/2 items-center justify-center rounded text-ink-mute hover:bg-panel-3 hover:text-ink"
              aria-label="Clear search"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pt-1 pb-4" aria-label="Channels and direct messages">
        {results ? (
          <ChatSearchResults
            query={query}
            results={results}
            onOpenPerson={(contact) => {
              onQueryChange("");
              onOpenPerson(contact);
            }}
            onOpenConversation={(id, messageId) => {
              onQueryChange("");
              onSelect(id, messageId);
            }}
          />
        ) : (
          <>
            <ul className="mt-2">
              <li>
                <button
                  type="button"
                  onClick={() => onSelect(THREADS_ID)}
                  aria-current={selectedId === THREADS_ID ? "page" : undefined}
                  className={cn(
                    "flex h-8 w-full items-center gap-2.5 rounded-md px-2 text-sm transition-colors",
                    selectedId === THREADS_ID ? "bg-cyan/10 font-semibold text-ink" : "text-ink-dim hover:bg-panel-3 hover:text-ink",
                  )}
                >
                  <MessageSquareText className="size-4 text-ink-mute" aria-hidden="true" />
                  Threads
                </button>
              </li>
            </ul>

            <ChatSidebarSection title="Channels" addLabel="Create channel" onAdd={onNewChannel} unread={unread(channels)}>
              {channels.map((c) => (
                <ConversationListItem key={c.id} conversation={c} active={c.id === selectedId} onSelect={onSelect} />
              ))}
              <li>
                <button
                  type="button"
                  onClick={onNewChannel}
                  className="flex h-8 w-full items-center gap-2.5 rounded-md px-2 text-sm text-ink-mute hover:bg-panel-3 hover:text-ink"
                >
                  <span className="flex size-4 items-center justify-center text-base leading-none" aria-hidden="true">
                    +
                  </span>
                  Add channel
                </button>
              </li>
            </ChatSidebarSection>

            <ChatSidebarSection title="Direct messages" addLabel="New direct message" onAdd={onNewChat} unread={unread(directs)}>
              {directs.map((c) => (
                <ConversationListItem key={c.id} conversation={c} active={c.id === selectedId} onSelect={onSelect} />
              ))}
              <li>
                <button
                  type="button"
                  onClick={onNewChat}
                  className="flex h-8 w-full items-center gap-2.5 rounded-md px-2 text-sm text-ink-mute hover:bg-panel-3 hover:text-ink"
                >
                  <span className="flex size-4 items-center justify-center text-base leading-none" aria-hidden="true">
                    +
                  </span>
                  New message
                </button>
              </li>
            </ChatSidebarSection>
          </>
        )}
      </nav>
    </aside>
  );
}
