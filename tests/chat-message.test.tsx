import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChatMessage, type ChatMessageHandlers } from "@/components/chat/chat-message";
import type { ChatMessageView } from "@/types/chat";

const ME = "u-me";
const OTHER = { id: "u-rahul", firstName: "Rahul", lastName: "Shah", avatarUrl: null };

function message(overrides: Partial<ChatMessageView> = {}): ChatMessageView {
  return {
    id: "m1",
    content: "Good morning everyone!",
    sender: OTHER,
    replyTo: null,
    reactions: [],
    editedAt: null,
    deletedAt: null,
    createdAt: "2026-09-29T10:32:00.000Z",
    updatedAt: "2026-09-29T10:32:00.000Z",
    ...overrides,
  };
}

function handlers(): ChatMessageHandlers {
  return { onReply: vi.fn(), onEdit: vi.fn(), onDelete: vi.fn(), onReact: vi.fn(), onRetry: vi.fn(), onDiscard: vi.fn(), onJumpTo: vi.fn() };
}

function renderMessage(m: ChatMessageView, h = handlers(), canModerate = false) {
  render(<ChatMessage message={m} me={ME} canModerate={canModerate} startsGroup endsGroup highlighted={false} {...h} />);
  return h;
}

describe("<ChatMessage>", () => {
  it("renders markup as text, never as HTML", () => {
    renderMessage(message({ content: '<img src=x onerror="alert(1)"> hi' }));
    expect(screen.getByText('<img src=x onerror="alert(1)"> hi')).toBeInTheDocument();
    expect(document.querySelector("img[src=x]")).toBeNull();
  });

  it("links only http(s) URLs", () => {
    renderMessage(message({ content: "see https://example.com/a?b=1. and javascript:alert(1)" }));
    const link = screen.getByRole("link", { name: "https://example.com/a?b=1" });
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it("offers edit and delete only on your own messages", () => {
    renderMessage(message());
    expect(screen.getByRole("button", { name: "Reply" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit message" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete message" })).not.toBeInTheDocument();
  });

  it("lets the author edit and delete", () => {
    const m = message({ sender: { ...OTHER, id: ME } });
    const h = renderMessage(m);
    fireEvent.click(screen.getByRole("button", { name: "Edit message" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete message" }));
    expect(h.onEdit).toHaveBeenCalledWith(m);
    expect(h.onDelete).toHaveBeenCalledWith(m);
  });

  it("lets a moderator delete, but not edit, someone else's message", () => {
    renderMessage(message(), handlers(), true);
    expect(screen.getByRole("button", { name: "Delete message" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit message" })).not.toBeInTheDocument();
  });

  it("shows a deleted message as a tombstone with no actions", () => {
    renderMessage(message({ content: "", deletedAt: "2026-09-29T10:40:00.000Z" }));
    expect(screen.getByText("This message was deleted.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reply" })).not.toBeInTheDocument();
  });

  it("highlights your reaction and toggles it on click", () => {
    const m = message({ reactions: [{ emoji: "👍", count: 5, userIds: [ME, "a", "b", "c", "d"] }] });
    const h = renderMessage(m);
    const chip = screen.getByRole("button", { name: /👍 5 reactions, including yours/ });
    expect(chip).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(chip);
    expect(h.onReact).toHaveBeenCalledWith(m, "👍");
  });

  it("offers Retry and Discard when sending failed", () => {
    const h = renderMessage(message({ id: "tmp-1", sender: { ...OTHER, id: ME }, status: "failed", error: "Your message couldn't be sent." }));
    expect(screen.getByText("Failed to send")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    fireEvent.click(screen.getByRole("button", { name: /discard/i }));
    expect(h.onRetry).toHaveBeenCalledWith("tmp-1");
    expect(h.onDiscard).toHaveBeenCalledWith("tmp-1");
  });

  it("shows what a reply answers, and jumps to it", () => {
    const h = renderMessage(message({ replyTo: { id: "orig", content: "Has the task been completed?", deleted: false, sender: OTHER } }));
    fireEvent.click(screen.getByRole("button", { name: /replying to rahul shah/i }));
    expect(h.onJumpTo).toHaveBeenCalledWith("orig");
  });
});
