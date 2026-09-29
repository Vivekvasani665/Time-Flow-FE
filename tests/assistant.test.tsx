import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChatPage } from "@/components/chat/chat-page";
import { ApiError } from "@/lib/api/errors";
import { assistantService } from "@/services/assistant.service";
import { makeAuthUser, renderWithProviders } from "./utils";
import { setSearchParams } from "./setup";

vi.mock("@/services/assistant.service", () => ({
  assistantService: { status: vi.fn(), chat: vi.fn() },
}));
vi.mock("@/services/chat.service", () => ({
  chatService: { unread: vi.fn().mockResolvedValue({ count: 0, lastReadAt: null }), markRead: vi.fn(), list: vi.fn() },
}));

beforeEach(() => {
  sessionStorage.clear();
  vi.mocked(assistantService.status).mockResolvedValue({ enabled: true, name: "TimeFlow Assistant", model: "claude-opus-5-5" });
});

function openAssistant() {
  setSearchParams({ c: "assistant" });
  renderWithProviders(<ChatPage />, { user: makeAuthUser() });
  return within(screen.getByRole("region", { name: "Conversation" }));
}

describe("TimeFlow Assistant", () => {
  it("is pinned at the top of the chat list", () => {
    setSearchParams();
    renderWithProviders(<ChatPage />, { user: makeAuthUser() });
    const nav = within(screen.getByRole("navigation", { name: "Channels and direct messages" }));
    expect(nav.getAllByRole("button")[0]).toHaveAccessibleName(/TimeFlow Assistant/);
  });

  it("offers starter questions and streams the answer in", async () => {
    vi.mocked(assistantService.chat).mockImplementation(async (turns, onEvent) => {
      expect(turns).toEqual([{ role: "user", content: "What are my tasks?" }]);
      onEvent({ type: "status", text: "Looking up tasks…" });
      onEvent({ type: "delta", text: "You have 2 tasks:\n" });
      onEvent({ type: "delta", text: "- Fix login bug" });
      onEvent({ type: "done" });
    });
    const pane = openAssistant();
    fireEvent.click(pane.getByRole("button", { name: "What are my tasks?" }));

    expect(await pane.findByText(/You have 2 tasks:/)).toHaveTextContent("You have 2 tasks: - Fix login bug");
    // The assistant's answers can't be edited, deleted or replied to.
    expect(pane.queryByRole("button", { name: "Reply" })).not.toBeInTheDocument();
  });

  it("sends the earlier conversation with each new question", async () => {
    vi.mocked(assistantService.chat).mockImplementation(async (_turns, onEvent) => {
      onEvent({ type: "delta", text: "Two." });
      onEvent({ type: "done" });
    });
    const pane = openAssistant();
    const input = pane.getByPlaceholderText("Ask about your projects and tasks…");
    fireEvent.change(input, { target: { value: "How many projects?" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await pane.findByText("Two.");

    fireEvent.change(input, { target: { value: "Which one is late?" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(assistantService.chat).toHaveBeenCalledTimes(2));
    expect(vi.mocked(assistantService.chat).mock.calls[1]![0]).toEqual([
      { role: "user", content: "How many projects?" },
      { role: "assistant", content: "Two." },
      { role: "user", content: "Which one is late?" },
    ]);
  });

  it("marks the question failed with a reason, and retries it", async () => {
    vi.mocked(assistantService.status).mockResolvedValue({ enabled: false, name: "TimeFlow Assistant", model: "claude-opus-5-5" });
    vi.mocked(assistantService.chat).mockRejectedValueOnce(new ApiError(503, "ASSISTANT_DISABLED", "not set up"));
    const pane = openAssistant();
    expect(await pane.findByText(/isn't set up yet/)).toBeInTheDocument();

    fireEvent.click(pane.getByRole("button", { name: "Summarize my active projects" }));
    expect(await pane.findByText("Failed to send")).toHaveAttribute("title", "The assistant isn't set up yet.");

    vi.mocked(assistantService.chat).mockImplementationOnce(async (_t, onEvent) => {
      onEvent({ type: "delta", text: "All on track." });
      onEvent({ type: "done" });
    });
    fireEvent.click(pane.getByRole("button", { name: /retry/i }));
    expect(await pane.findByText("All on track.")).toBeInTheDocument();
    expect(pane.queryByText("Failed to send")).not.toBeInTheDocument();
  });
});
