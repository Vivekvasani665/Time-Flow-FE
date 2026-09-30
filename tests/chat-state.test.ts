import { describe, expect, it } from "vitest";
import {
  addOptimistic,
  discardPending,
  EMPTY_TIMELINE,
  markFailed,
  mergeLatest,
  prependOlder,
  setReactions,
  startsGroup,
  typingLabel,
  upsertMessage,
  type ChatTimeline,
} from "@/lib/chat-state";
import type { ChatMessage } from "@/types/chat";

const RAHUL = { id: "u-rahul", firstName: "Rahul", lastName: "Shah", avatarUrl: null };
const PRIYA = { id: "u-priya", firstName: "Priya", lastName: "Patel", avatarUrl: null };

function msg(id: string, minute: number, overrides: Partial<ChatMessage> = {}): ChatMessage {
  const at = new Date(Date.UTC(2026, 8, 29, 10, minute)).toISOString();
  return { id, content: `message ${id}`, sender: RAHUL, replyTo: null, reactions: [], editedAt: null, deletedAt: null, createdAt: at, updatedAt: at, ...overrides };
}

const ids = (t: ChatTimeline) => t.messages.map((m) => m.id);
const page = (items: ChatMessage[], hasMore = false, nextCursor: string | null = null) => ({ items, hasMore, nextCursor });

describe("chat timeline", () => {
  it("shows the first page oldest-first and keeps its cursor", () => {
    const t = mergeLatest(EMPTY_TIMELINE, page([msg("c", 3), msg("b", 2), msg("a", 1)], true, "a"), true);
    expect(ids(t)).toEqual(["a", "b", "c"]);
    expect(t).toMatchObject({ hasMore: true, cursor: "a" });
  });

  it("prepends older pages without duplicates", () => {
    const t = mergeLatest(EMPTY_TIMELINE, page([msg("c", 3), msg("b", 2)], true, "b"), true);
    const older = prependOlder(t, page([msg("b", 2), msg("a", 1)], false, null));
    expect(ids(older)).toEqual(["a", "b", "c"]);
    expect(older.hasMore).toBe(false);
  });

  it("a resync after reconnecting adds missed messages but keeps the loaded history's cursor", () => {
    let t = mergeLatest(EMPTY_TIMELINE, page([msg("b", 2)], true, "b"), true);
    t = prependOlder(t, page([msg("a", 1)], true, "a"));
    t = mergeLatest(t, page([msg("d", 4), msg("c", 3), msg("b", 2)], true, "b"), false);
    expect(ids(t)).toEqual(["a", "b", "c", "d"]);
    expect(t.cursor).toBe("a");
  });

  it("replaces the optimistic copy with the server's, whichever of ack or broadcast lands first", () => {
    let t = addOptimistic(EMPTY_TIMELINE, { ...msg("tmp-1", 5), sender: PRIYA });
    expect(t.messages[0]?.status).toBe("sending");

    const saved = { ...msg("srv-1", 5), sender: PRIYA, clientId: "tmp-1" };
    t = upsertMessage(t, saved); // broadcast
    t = upsertMessage(t, saved); // then the ack
    expect(ids(t)).toEqual(["srv-1"]);
    expect(t.messages[0]?.status).toBeUndefined();
    expect(t.messages[0]).not.toHaveProperty("clientId");
  });

  it("keeps unconfirmed messages below everything the server has confirmed", () => {
    let t = addOptimistic(mergeLatest(EMPTY_TIMELINE, page([msg("a", 1)]), true), msg("tmp", 9));
    t = upsertMessage(t, msg("b", 2));
    expect(ids(t)).toEqual(["a", "b", "tmp"]);
  });

  it("marks failures, and can discard them", () => {
    let t = addOptimistic(EMPTY_TIMELINE, msg("tmp", 1));
    t = markFailed(t, "tmp", "Your message couldn't be sent. Please try again.");
    expect(t.messages[0]).toMatchObject({ status: "failed", error: expect.stringMatching(/couldn't be sent/) });
    expect(ids(discardPending(t, "tmp"))).toEqual([]);
  });

  it("never lets an older copy overwrite a newer edit", () => {
    const edited = msg("a", 1, { content: "new", updatedAt: "2026-09-29T11:00:00.000Z" });
    let t = upsertMessage(EMPTY_TIMELINE, edited);
    t = upsertMessage(t, msg("a", 1, { content: "old" }));
    expect(t.messages[0]?.content).toBe("new");
  });

  it("updates reply previews when the original is edited or deleted", () => {
    const reply = msg("r", 2, { replyTo: { id: "a", content: "original", deleted: false, sender: RAHUL } });
    let t = mergeLatest(EMPTY_TIMELINE, page([reply, msg("a", 1)]), true);
    t = upsertMessage(t, msg("a", 1, { content: "", deletedAt: "2026-09-29T10:05:00.000Z", updatedAt: "2026-09-29T10:05:00.000Z" }));
    expect(t.messages[1]?.replyTo).toMatchObject({ deleted: true, content: "" });
  });

  it("applies reaction updates", () => {
    const t = setReactions(upsertMessage(EMPTY_TIMELINE, msg("a", 1)), "a", [{ emoji: "👍", count: 1, userIds: [PRIYA.id] }]);
    expect(t.messages[0]?.reactions).toHaveLength(1);
  });
});

describe("chat presentation helpers", () => {
  it("describes who is typing", () => {
    expect(typingLabel([])).toBe("");
    expect(typingLabel(["Rahul"])).toBe("Rahul is typing…");
    expect(typingLabel(["Rahul", "Priya"])).toBe("Rahul and Priya are typing…");
    expect(typingLabel(["Rahul", "Priya", "Kai"])).toBe("Rahul, Priya and 1 other are typing…");
    expect(typingLabel(["Rahul", "Priya", "Kai", "Ada"])).toBe("Rahul, Priya and 2 others are typing…");
  });

  it("groups a run of messages from one person", () => {
    expect(startsGroup(msg("b", 2), msg("a", 1))).toBe(false);
    expect(startsGroup({ ...msg("b", 2), sender: PRIYA }, msg("a", 1))).toBe(true);
    expect(startsGroup(msg("b", 20), msg("a", 1))).toBe(true);
    expect(startsGroup(msg("a", 1), undefined)).toBe(true);
  });
});
