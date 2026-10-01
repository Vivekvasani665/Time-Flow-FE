import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChatPage } from "@/components/chat/chat-page";
import { renderWithProviders, makeAuthUser } from "./utils";
import { routerMock, setSearchParams } from "./setup";

vi.mock("@/services/chat.service", () => ({
  chatService: { unread: vi.fn().mockResolvedValue({ count: 4, lastReadAt: null }), markRead: vi.fn(), list: vi.fn() },
}));

// Only real team members appear in Chat; there are no sample people or conversations.
const ZOE = { id: "33333333-3333-4333-8333-333333333333", firstName: "Zoe", lastName: "Chen", email: "zoe@timeflow.dev", avatarUrl: null, online: true };
const KAI = { id: "44444444-4444-4444-8444-444444444444", firstName: "Kai", lastName: "Brown", email: "kai@timeflow.dev", avatarUrl: null, online: false };
vi.mock("@/services/call.service", () => ({ callService: { contacts: vi.fn(async () => [ZOE, KAI]), history: vi.fn().mockResolvedValue([]), iceServers: vi.fn() } }));

const ME = makeAuthUser(undefined, { firstName: "Vivek", lastName: "Vasani" });

function renderChat(params: Record<string, string> = {}) {
  setSearchParams(params);
  return renderWithProviders(<ChatPage />, { user: ME });
}

const sidebar = () => within(screen.getByRole("navigation", { name: "Channels and direct messages" }));

describe("Chat page", () => {
  it("lists only real conversations and team members, and asks to pick a conversation", async () => {
    renderChat();
    expect(screen.getByText("Select a conversation")).toBeInTheDocument();
    // # General is the live Global Chat; its count comes from the API.
    expect(await sidebar().findByRole("button", { name: "General channel, 4 unread" })).toBeInTheDocument();
    expect(sidebar().getByRole("button", { name: /TimeFlow Assistant/ })).toBeInTheDocument();
    expect(await sidebar().findByRole("button", { name: "Zoe Chen, Online. Open conversation" })).toBeInTheDocument();
    expect(sidebar().getByRole("button", { name: "Kai Brown, Offline. Open conversation" })).toBeInTheDocument();
    // No demo data: no sample channel, people or messages.
    for (const sample of [/Leave Monitoring/, /Rahul/, /Priya/, /Amit/, /Samir/, /Rachit/]) {
      expect(sidebar().queryByRole("button", { name: sample })).not.toBeInTheDocument();
    }
    expect(screen.queryByText("Two tasks look blocked.")).not.toBeInTheDocument();
  });

  it("opens a team member's conversation through the URL, so Back returns to the list on phones", async () => {
    renderChat();
    fireEvent.click(await sidebar().findByRole("button", { name: /Zoe Chen, Online/ }));
    expect(routerMock.push).toHaveBeenCalledWith(`/?c=dm-${ZOE.id}`, { scroll: false });
  });

  it("shows a direct conversation with a real person, starting empty, and sends locally", async () => {
    renderChat({ c: `dm-${ZOE.id}` });
    const pane = within(await screen.findByRole("region", { name: "Conversation" }));
    expect(await pane.findByRole("heading", { name: "Zoe Chen" })).toBeInTheDocument();
    expect(pane.getByText("Online")).toBeInTheDocument();
    expect(pane.queryByText("New messages")).not.toBeInTheDocument();

    const input = pane.getByPlaceholderText("Message Zoe");
    fireEvent.change(input, { target: { value: "On my way to the board now" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(await pane.findByText("On my way to the board now")).toBeInTheDocument();
    expect(input).toHaveValue("");
  });

  it("searches people and messages", async () => {
    renderChat();
    await sidebar().findByRole("button", { name: /Kai Brown/ });
    fireEvent.change(screen.getByRole("searchbox", { name: "Search people or messages" }), { target: { value: "kai" } });
    const results = within(screen.getByRole("region", { name: "Search results for kai" }));
    expect(results.getByText("People")).toBeInTheDocument();
    expect(results.getByRole("button", { name: /Kai Brown/ })).toBeInTheDocument();
  });

  it("validates and creates a channel", async () => {
    renderChat();
    fireEvent.click(sidebar().getByRole("button", { name: "Add channel" }));
    const dialog = within(await screen.findByRole("dialog"));

    fireEvent.change(dialog.getByLabelText(/Channel name/), { target: { value: "general" } });
    fireEvent.click(dialog.getByRole("button", { name: "Create channel" }));
    expect(dialog.getByText("A channel with this name already exists")).toBeInTheDocument();

    fireEvent.change(dialog.getByLabelText(/Channel name/), { target: { value: "Design Reviews" } });
    fireEvent.click(dialog.getByLabelText(/Private/));
    fireEvent.click(dialog.getByRole("button", { name: "Create channel" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(sidebar().getByRole("button", { name: "Design Reviews channel" })).toBeInTheDocument();
    expect(routerMock.push).toHaveBeenCalledWith(expect.stringMatching(/^\/\?c=channel-design-reviews-/), { scroll: false });
  });

  it("starts a direct message from the new chat dialog", async () => {
    renderChat();
    fireEvent.click(screen.getByRole("button", { name: "Start a new chat" }));
    const dialog = within(await screen.findByRole("dialog"));
    fireEvent.change(dialog.getByRole("searchbox", { name: "Search people" }), { target: { value: "kai" } });
    fireEvent.click(await dialog.findByRole("button", { name: /Kai Brown/ }));
    expect(routerMock.push).toHaveBeenCalledWith(`/?c=dm-${KAI.id}`, { scroll: false });
    expect(sidebar().getByRole("button", { name: "Kai Brown" })).toBeInTheDocument();
  });
});
