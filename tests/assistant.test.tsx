import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChatPage } from "@/components/chat/chat-page";
import { ApiError } from "@/lib/api/errors";
import { assistantService } from "@/services/assistant.service";
import { makeAuthUser, renderWithProviders } from "./utils";
import { setSearchParams } from "./setup";

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }), Toaster: () => null }));
vi.mock("@/services/assistant.service", () => ({
  assistantService: { status: vi.fn(), chat: vi.fn(), readDocument: vi.fn() },
}));
vi.mock("@/services/chat.service", () => ({
  chatService: { unread: vi.fn().mockResolvedValue({ count: 0, lastReadAt: null }), markRead: vi.fn(), list: vi.fn() },
}));

beforeEach(() => {
  sessionStorage.clear();
  vi.mocked(assistantService.status).mockResolvedValue({ enabled: true, name: "TimeFlow Assistant", model: "openai/gpt-oss-120b" });
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
      expect(turns).toEqual([{ role: "user", content: "Which of my tasks are overdue?" }]);
      onEvent({ type: "status", text: "Looking up tasks…" });
      onEvent({ type: "delta", text: "You have 2 tasks:\n" });
      onEvent({ type: "delta", text: "- Fix login bug" });
      onEvent({ type: "done" });
    });
    const pane = openAssistant();
    fireEvent.click(pane.getByRole("button", { name: "Which of my tasks are overdue?" }));

    expect(await pane.findByText("You have 2 tasks:")).toBeInTheDocument();
    // Replies are Markdown: the "- " line is a real list item.
    expect(pane.getByRole("listitem")).toHaveTextContent("Fix login bug");
    // The assistant's answers can't be edited, deleted or replied to.
    expect(pane.queryByRole("button", { name: "Reply" })).not.toBeInTheDocument();
  });

  it("sends the earlier conversation with each new question", async () => {
    vi.mocked(assistantService.chat).mockImplementation(async (_turns, onEvent) => {
      onEvent({ type: "delta", text: "Two." });
      onEvent({ type: "done" });
    });
    const pane = openAssistant();
    const input = pane.getByPlaceholderText("Ask anything…");
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
    vi.mocked(assistantService.status).mockResolvedValue({ enabled: false, name: "TimeFlow Assistant", model: "openai/gpt-oss-120b" });
    vi.mocked(assistantService.chat).mockRejectedValueOnce(new ApiError(503, "ASSISTANT_DISABLED", "not set up"));
    const pane = openAssistant();
    expect(await pane.findByText(/isn't set up yet/)).toBeInTheDocument();

    fireEvent.click(pane.getByRole("button", { name: "What should I focus on today?" }));
    expect(await pane.findByText("Failed to send")).toBeInTheDocument();
    // Once in the banner, once as the reason under the failed question.
    expect(pane.getAllByText("The assistant isn't set up yet.")).toHaveLength(2);

    vi.mocked(assistantService.chat).mockImplementationOnce(async (_t, onEvent) => {
      onEvent({ type: "delta", text: "All on track." });
      onEvent({ type: "done" });
    });
    fireEvent.click(pane.getByRole("button", { name: /retry/i }));
    expect(await pane.findByText("All on track.")).toBeInTheDocument();
    expect(pane.queryByText("Failed to send")).not.toBeInTheDocument();
  });

  it("can stop an answer while it is being written, keeping what arrived", async () => {
    let signal: AbortSignal | undefined;
    vi.mocked(assistantService.chat).mockImplementation(async (_t, onEvent, abortSignal) => {
      signal = abortSignal;
      onEvent({ type: "delta", text: "Here is the start" });
      await new Promise<void>((_resolve, reject) =>
        abortSignal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError"))),
      );
    });
    const pane = openAssistant();
    fireEvent.click(pane.getByRole("button", { name: "What should I focus on today?" }));
    await pane.findByText("Here is the start");

    fireEvent.click(pane.getByRole("button", { name: "Stop generating" }));
    await waitFor(() => expect(pane.getByRole("button", { name: "Send message" })).toBeInTheDocument());
    expect(signal?.aborted).toBe(true);
    expect(pane.getByText("Here is the start")).toBeInTheDocument();
    expect(pane.queryByText("Sending…")).not.toBeInTheDocument();
  });

  it("reads an attached document and sends its text with the question, and again with follow-ups", async () => {
    const doc = { kind: "document" as const, name: "plan.pdf", text: "Sprint 5: write docs, fix login", truncated: false };
    vi.mocked(assistantService.readDocument).mockResolvedValue(doc);
    vi.mocked(assistantService.chat).mockImplementation(async (_t, onEvent) => {
      onEvent({ type: "delta", text: "Done." });
      onEvent({ type: "done" });
    });
    const pane = openAssistant();
    const file = new File(["%PDF-"], "plan.pdf", { type: "application/pdf" });
    fireEvent.change(pane.getByTestId("chat-file-input"), { target: { files: [file] } });

    const attached = await pane.findByRole("list", { name: "Attached files" });
    await waitFor(() => expect(within(attached).queryByText("(preparing)")).not.toBeInTheDocument());
    expect(assistantService.readDocument).toHaveBeenCalledWith(file);

    // A file alone can be sent, without typing anything.
    fireEvent.click(pane.getByRole("button", { name: "Send message" }));
    await pane.findByText("Done.");
    expect(vi.mocked(assistantService.chat).mock.calls[0]![0]).toEqual([
      { role: "user", content: "", attachments: [{ kind: "document", name: "plan.pdf", text: doc.text }] },
    ]);
    expect(within(pane.getByRole("list", { name: "Attachments" })).getByText("plan.pdf")).toBeInTheDocument();
    expect(pane.queryByRole("list", { name: "Attached files" })).not.toBeInTheDocument();

    const input = pane.getByPlaceholderText("Ask anything…");
    fireEvent.change(input, { target: { value: "Make tasks from it" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(assistantService.chat).toHaveBeenCalledTimes(2));
    expect(vi.mocked(assistantService.chat).mock.calls[1]![0][0]).toMatchObject({ attachments: [{ name: "plan.pdf" }] });
  });

  it("explains why a file couldn't be attached", async () => {
    const pane = openAssistant();
    fireEvent.change(pane.getByTestId("chat-file-input"), { target: { files: [new File(["MZ"], "setup.exe")] } });
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Couldn't attach the file", { description: expect.stringMatching(/setup.exe can't be read/) }),
    );
    expect(pane.queryByRole("list", { name: "Attached files" })).not.toBeInTheDocument();
    expect(assistantService.readDocument).not.toHaveBeenCalled();
  });

  it("names pictures that were not kept after a reload instead of sending them", async () => {
    const user = makeAuthUser();
    const saved = [
      {
        id: "q1", content: "What is this?", sender: { id: user.id, firstName: user.firstName, lastName: user.lastName, avatarUrl: null },
        replyTo: null, reactions: [], editedAt: null, deletedAt: null, createdAt: "2026-09-30T09:00:00Z", updatedAt: "2026-09-30T09:00:00Z",
        attachments: [{ kind: "image", name: "board.png", dataUrl: null }],
      },
    ];
    sessionStorage.setItem(`tf.assistant.${user.id}`, JSON.stringify(saved));
    vi.mocked(assistantService.chat).mockImplementation(async (_t, onEvent) => onEvent({ type: "done" }));
    setSearchParams({ c: "assistant" });
    renderWithProviders(<ChatPage />, { user });
    const pane = within(screen.getByRole("region", { name: "Conversation" }));
    expect(pane.getByTitle("board.png (not kept after reload)")).toBeInTheDocument();

    const input = pane.getByPlaceholderText("Ask anything…");
    fireEvent.change(input, { target: { value: "And now?" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(assistantService.chat).toHaveBeenCalled());
    expect(vi.mocked(assistantService.chat).mock.calls[0]![0][0]).toEqual({
      role: "user",
      content: "What is this?\n\n[Attached earlier, no longer available to you: board.png]",
    });
  });
});
