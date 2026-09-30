import type { ChatMessage, ChatMessageView, ChatReaction } from "@/types/chat";

/**
 * Pure state transitions for the chat timeline. Messages are kept oldest →
 * newest. Server messages are keyed by id; the sender's unconfirmed messages
 * by their clientId until the server's copy (carrying that clientId) replaces
 * them — whichever of the ack or the broadcast arrives first.
 */
export type ChatTimeline = {
  messages: ChatMessageView[];
  hasMore: boolean;
  cursor: string | null;
};

export const EMPTY_TIMELINE: ChatTimeline = { messages: [], hasMore: false, cursor: null };

const byTime = (a: ChatMessageView, b: ChatMessageView) =>
  a.createdAt === b.createdAt ? (a.id < b.id ? -1 : a.id > b.id ? 1 : 0) : a.createdAt < b.createdAt ? -1 : 1;

const isPending = (m: ChatMessageView) => m.status !== undefined;

/** Keeps each message's reply preview in step with the message it quotes. */
function refreshReplyPreviews(messages: ChatMessageView[], changed: ChatMessage): ChatMessageView[] {
  let touched = false;
  const next = messages.map((m) => {
    if (m.replyTo?.id !== changed.id) return m;
    touched = true;
    const deleted = changed.deletedAt !== null;
    return { ...m, replyTo: { ...m.replyTo, content: deleted ? "" : changed.content, deleted } };
  });
  return touched ? next : messages;
}

/** Adds or replaces a server message. Older copies (by updatedAt) never overwrite newer ones. */
export function upsertMessage(timeline: ChatTimeline, incoming: ChatMessage): ChatTimeline {
  const { clientId, ...message } = incoming;
  let messages = timeline.messages;

  const existing = messages.findIndex((m) => m.id === message.id);
  if (existing >= 0) {
    if (messages[existing]!.updatedAt > message.updatedAt) return timeline;
    messages = messages.map((m, i) => (i === existing ? message : m));
  } else {
    // The sender's optimistic copy is swapped out rather than duplicated.
    const optimistic = clientId ? messages.findIndex((m) => m.id === clientId && isPending(m)) : -1;
    const settled = optimistic >= 0 ? messages.filter((_, i) => i !== optimistic) : messages;
    const confirmed = settled.filter((m) => !isPending(m));
    const pending = settled.filter(isPending);
    messages = [...confirmed, message].sort(byTime).concat(pending);
  }
  return { ...timeline, messages: refreshReplyPreviews(messages, message) };
}

/**
 * The newest page, merged in so nothing already shown disappears. `initial`
 * takes its paging cursor; a resync after reconnecting keeps the cursor of
 * the older history already loaded.
 */
export function mergeLatest(timeline: ChatTimeline, page: { items: ChatMessage[]; hasMore: boolean; nextCursor: string | null }, initial: boolean): ChatTimeline {
  let next = timeline;
  for (const m of page.items) next = upsertMessage(next, m);
  return initial ? { ...next, hasMore: page.hasMore, cursor: page.nextCursor } : next;
}

/** An older page, inserted before everything shown. */
export function prependOlder(timeline: ChatTimeline, page: { items: ChatMessage[]; hasMore: boolean; nextCursor: string | null }): ChatTimeline {
  const known = new Set(timeline.messages.map((m) => m.id));
  const older = page.items.filter((m) => !known.has(m.id)).reverse();
  return { messages: [...older, ...timeline.messages], hasMore: page.hasMore, cursor: page.nextCursor };
}

export function addOptimistic(timeline: ChatTimeline, message: ChatMessageView): ChatTimeline {
  return { ...timeline, messages: [...timeline.messages, { ...message, status: "sending" }] };
}

export function markFailed(timeline: ChatTimeline, clientId: string, error: string): ChatTimeline {
  return {
    ...timeline,
    messages: timeline.messages.map((m) => (m.id === clientId && isPending(m) ? { ...m, status: "failed", error } : m)),
  };
}

export function markSending(timeline: ChatTimeline, clientId: string): ChatTimeline {
  return {
    ...timeline,
    messages: timeline.messages.map((m) => (m.id === clientId && isPending(m) ? { ...m, status: "sending", error: undefined } : m)),
  };
}

export function discardPending(timeline: ChatTimeline, clientId: string): ChatTimeline {
  return { ...timeline, messages: timeline.messages.filter((m) => !(m.id === clientId && isPending(m))) };
}

export function setReactions(timeline: ChatTimeline, messageId: string, reactions: ChatReaction[]): ChatTimeline {
  if (!timeline.messages.some((m) => m.id === messageId)) return timeline;
  return { ...timeline, messages: timeline.messages.map((m) => (m.id === messageId ? { ...m, reactions } : m)) };
}

/** "Rahul is typing…", "Rahul and Priya are typing…", "Rahul, Priya and 2 others are typing…" */
export function typingLabel(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return `${names[0]} is typing…`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`;
  const others = names.length - 2;
  return `${names[0]}, ${names[1]} and ${others} ${others === 1 ? "other" : "others"} are typing…`;
}

/** Consecutive messages from one person within this window share a single name/avatar header. */
const GROUP_WINDOW_MS = 5 * 60_000;

export function startsGroup(message: ChatMessageView, previous: ChatMessageView | undefined): boolean {
  if (!previous) return true;
  if (previous.sender.id !== message.sender.id) return true;
  if (!sameDay(previous.createdAt, message.createdAt)) return true;
  return new Date(message.createdAt).getTime() - new Date(previous.createdAt).getTime() > GROUP_WINDOW_MS;
}

export function sameDay(a: string, b: string): boolean {
  return new Date(a).toDateString() === new Date(b).toDateString();
}
