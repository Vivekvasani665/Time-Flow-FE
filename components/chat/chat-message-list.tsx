"use client";

import { ArrowDown } from "lucide-react";
import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";
import { sameDay, startsGroup } from "@/lib/chat-state";
import type { ChatMessageView } from "@/types/chat";
import { ChatMessage, type ChatMessageHandlers } from "./chat-message";

/** Within this distance of the bottom, new messages keep the view pinned to the latest. */
const BOTTOM_THRESHOLD_PX = 96;
/** Start fetching older history this close to the top, before the reader hits the edge. */
const TOP_THRESHOLD_PX = 160;

// Local time: "today" is the reader's today.
const dayFmt = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "short", day: "numeric", year: "numeric" });

function dayLabel(iso: string): string {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(iso, now.toISOString())) return "Today";
  if (sameDay(iso, yesterday.toISOString())) return "Yesterday";
  return dayFmt.format(new Date(iso));
}

type ChatMessageListProps = Omit<ChatMessageHandlers, "onJumpTo"> & {
  messages: ChatMessageView[];
  me: string | null;
  canModerate: boolean;
  hasMore: boolean;
  loadingOlder: boolean;
  onLoadOlder: () => void;
  empty: ReactNode;
  /** Shown above the oldest message once the whole history is loaded. */
  beginningLabel: string;
  /** Messages from others after this time get a "New messages" divider before the first of them. */
  newSince?: string | null;
  /** Scrolled to and highlighted when set (e.g. opened from a search result). */
  focusId?: string | null;
  interactive?: boolean;
};

export function ChatMessageList({
  messages,
  me,
  canModerate,
  hasMore,
  loadingOlder,
  onLoadOlder,
  empty,
  beginningLabel,
  newSince = null,
  focusId = null,
  interactive = true,
  ...handlers
}: ChatMessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const firstId = useRef<string | undefined>(undefined);
  const lastId = useRef<string | undefined>(undefined);
  const scrollHeight = useRef(0);
  const [unseen, setUnseen] = useState(0);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  const scrollToBottom = useCallback((smooth = false) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
    atBottom.current = true;
    setUnseen(0);
  }, []);

  // Runs before paint, so the reader never sees the list jump.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const first = messages[0]?.id;
    const last = messages.at(-1);

    if (firstId.current && first !== firstId.current && last?.id === lastId.current) {
      // Older history went in above: keep the same message under the reader's eye.
      el.scrollTop += el.scrollHeight - scrollHeight.current;
    } else if (last && last.id !== lastId.current) {
      const opening = lastId.current === undefined;
      const divider = opening ? el.querySelector<HTMLElement>("[data-new-divider]") : null;
      if (divider) {
        // Open where the unread part starts, not below it.
        el.scrollTop = divider.offsetTop - 16;
        atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < BOTTOM_THRESHOLD_PX;
      } else if (opening || atBottom.current || last.sender.id === me) scrollToBottom();
      else setUnseen((n) => n + 1);
    } else if (atBottom.current && el.scrollHeight !== scrollHeight.current) {
      // The last message grew (a streamed answer): stay with it.
      el.scrollTop = el.scrollHeight;
    }
    firstId.current = first;
    lastId.current = last?.id;
    scrollHeight.current = el.scrollHeight;
  }, [messages, me, scrollToBottom]);

  // A short history may not fill the screen, leaving nothing to scroll up with.
  useEffect(() => {
    const el = scrollRef.current;
    if (el && hasMore && !loadingOlder && messages.length > 0 && el.scrollHeight <= el.clientHeight) onLoadOlder();
  }, [hasMore, loadingOlder, messages.length, onLoadOlder]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < BOTTOM_THRESHOLD_PX;
    if (atBottom.current && unseen > 0) setUnseen(0);
    if (el.scrollTop < TOP_THRESHOLD_PX && hasMore && !loadingOlder) {
      scrollHeight.current = el.scrollHeight;
      onLoadOlder();
    }
  };

  // Computed once per list: the divider stays put while new messages arrive.
  const [firstNewId] = useState(() =>
    newSince ? (messages.find((m) => m.sender.id !== me && m.createdAt > newSince)?.id ?? null) : null,
  );

  const onJumpTo = useCallback((id: string) => {
    const target = document.getElementById(`chat-message-${id}`);
    if (!target) {
      toast("That message is further back", { description: "Scroll up to load earlier messages." });
      return;
    }
    target.scrollIntoView({ block: "center", behavior: "smooth" });
    setHighlightId(id);
    setTimeout(() => setHighlightId((current) => (current === id ? null : current)), 1_600);
  }, []);

  useEffect(() => {
    if (focusId && messages.some((m) => m.id === focusId)) onJumpTo(focusId);
    // Only when asked to focus something new, not on every message.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId]);

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="h-full overflow-y-auto overscroll-contain py-3"
        role="log"
        aria-label="Chat messages"
        aria-live="polite"
        aria-relevant="additions"
      >
        {messages.length === 0 ? (
          empty
        ) : (
          <>
            <div className="flex h-8 items-center justify-center text-xs text-ink-mute">
              {loadingOlder ? (
                <Spinner className="size-4" />
              ) : hasMore ? (
                <button type="button" onClick={onLoadOlder} className="rounded-md px-2 py-1 hover:bg-panel-3 hover:text-ink">
                  Load earlier messages
                </button>
              ) : (
                <span>{beginningLabel}</span>
              )}
            </div>
            {messages.map((message, i) => {
              const previous = messages[i - 1];
              const next = messages[i + 1];
              const newDay = !previous || !sameDay(previous.createdAt, message.createdAt);
              return (
                <Fragment key={message.id}>
                  {message.id === firstNewId && (
                    <div className="my-3 flex items-center gap-3 px-5" role="separator" data-new-divider>
                      <span className="h-px flex-1 bg-danger/40" />
                      <span className="text-[0.6875rem] font-semibold tracking-wide text-danger uppercase">New messages</span>
                      <span className="h-px flex-1 bg-danger/40" />
                    </div>
                  )}
                  {newDay && (
                    <div className="my-4 flex items-center gap-3 px-5" role="separator">
                      <span className="h-px flex-1 bg-line" />
                      <span className="eyebrow">{dayLabel(message.createdAt)}</span>
                      <span className="h-px flex-1 bg-line" />
                    </div>
                  )}
                  <ChatMessage
                    message={message}
                    me={me}
                    canModerate={canModerate}
                    startsGroup={startsGroup(message, previous)}
                    endsGroup={!next || startsGroup(next, message)}
                    highlighted={highlightId === message.id}
                    interactive={interactive}
                    onJumpTo={onJumpTo}
                    {...handlers}
                  />
                </Fragment>
              );
            })}
          </>
        )}
      </div>

      {unseen > 0 && (
        <button
          type="button"
          onClick={() => scrollToBottom(true)}
          className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-cyan px-3.5 py-1.5 text-xs font-semibold text-white shadow-[var(--shadow-overlay)] motion-safe:animate-fade-up [:root[data-theme=dark]_&]:text-void"
        >
          {unseen} new {unseen === 1 ? "message" : "messages"}
          <ArrowDown className="size-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
