"use client";

import { ChevronLeft } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { useChatWorkspace } from "@/hooks/use-chat-workspace";
import { cn } from "@/lib/utils";
import type { ChatContact } from "@/types/chat";
import { ChatEmptyState, ThreadsEmptyState } from "./chat-empty-state";
import { chatIconButton } from "./chat-reaction-picker";
import { ChatSidebar, THREADS_ID } from "./chat-sidebar";
import { LiveConversation, MockConversation } from "./conversation-view";
import { CreateChannelDialog } from "./create-channel-dialog";
import { NewChatDialog } from "./new-chat-dialog";

const SMALL_SCREEN = "(max-width: 767px)";

/**
 * Chat: conversation list beside the open conversation. The open conversation
 * lives in the URL (`?c=<id>`, plus `&m=<messageId>` to jump to a message), so
 * links work and, on phones, Back returns from a conversation to the list.
 */
export function ChatPage() {
  const workspace = useChatWorkspace();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [query, setQuery] = useState("");
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [newChannelOpen, setNewChannelOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const selectedId = params.get("c");
  const focusId = params.get("m");
  const selected = workspace.conversations.find((c) => c.id === selectedId) ?? null;
  const showingThreads = selectedId === THREADS_ID;
  const paneOpen = Boolean(selected) || showingThreads;

  const select = useCallback(
    (id: string, messageId?: string) => {
      const search = new URLSearchParams({ c: id, ...(messageId ? { m: messageId } : {}) });
      router.push(`${pathname}?${search}`, { scroll: false });
    },
    [router, pathname],
  );

  const back = useCallback(() => router.push(pathname, { scroll: false }), [router, pathname]);

  const openPerson = useCallback(
    (contact: ChatContact) => {
      setNewChatOpen(false);
      select(workspace.openDirect(contact));
    },
    [select, workspace],
  );

  // The search box lives in the list; on a phone that means going back to it first.
  const focusSearch = useCallback(() => {
    if (window.matchMedia(SMALL_SCREEN).matches) back();
    setTimeout(() => searchRef.current?.focus(), 50);
  }, [back]);

  const viewProps = { workspace, focusId, onBack: back, onSearch: focusSearch };

  return (
    <div className="hud-panel clip-corner flex h-[calc(100dvh-7rem)] min-h-[26rem] lg:h-[calc(100dvh-8rem)]">
      <ChatSidebar
        workspace={workspace}
        selectedId={selectedId}
        onSelect={select}
        onOpenPerson={openPerson}
        onNewChat={() => setNewChatOpen(true)}
        onNewChannel={() => setNewChannelOpen(true)}
        query={query}
        onQueryChange={setQuery}
        searchRef={searchRef}
        className={cn("w-full shrink-0 md:flex md:w-64 md:border-r md:border-line lg:w-72", paneOpen ? "hidden" : "flex")}
      />

      <section className={cn("min-w-0 flex-1 flex-col", paneOpen ? "flex" : "hidden md:flex")} aria-label="Conversation">
        {selected?.live ? (
          <LiveConversation key={selected.id} conversation={selected} {...viewProps} />
        ) : selected && !workspace.ready ? null : selected ? (
          <MockConversation key={selected.id} conversation={selected} {...viewProps} />
        ) : showingThreads ? (
          <>
            <header className="flex h-16 shrink-0 items-center gap-2 border-b border-line px-2 sm:px-4">
              <button type="button" onClick={back} className={cn(chatIconButton, "size-9 md:hidden")} aria-label="Back to chats">
                <ChevronLeft className="size-5" />
              </button>
              <h2 className="text-[0.9375rem] font-semibold text-ink">Threads</h2>
            </header>
            <ThreadsEmptyState />
          </>
        ) : (
          <ChatEmptyState onNewChat={() => setNewChatOpen(true)} />
        )}
      </section>

      <NewChatDialog open={newChatOpen} onOpenChange={setNewChatOpen} contacts={workspace.contacts} onSelect={openPerson} />
      <CreateChannelDialog
        open={newChannelOpen}
        onOpenChange={setNewChannelOpen}
        isNameTaken={workspace.channelNameTaken}
        onCreate={(input) => select(workspace.createChannel(input))}
      />
    </div>
  );
}
