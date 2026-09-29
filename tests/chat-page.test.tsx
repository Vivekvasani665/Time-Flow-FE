import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChatPage } from "@/components/chat/chat-page";
import { renderWithProviders, makeAuthUser } from "./utils";
import { routerMock, setSearchParams } from "./setup";

vi.mock("@/services/chat.service", () => ({
  chatService: { unread: vi.fn().mockResolvedValue({ count: 4, lastReadAt: null }), markRead: vi.fn(), list: vi.fn() },
}));

const ME = makeAuthUser(undefined, { firstName: "Vivek", lastName: "Vasani" });

function renderChat(params: Record<string, string> = {}) {
  setSearchParams(params);
  return renderWithProviders(<ChatPage />, { user: ME });
}

const sidebar = () => within(screen.getByRole("navigation", { name: "Channels and direct messages" }));

describe("Chat page", () => {
  it("lists channels and direct messages, with unread counts, and asks to pick a conversation", async () => {
    renderChat();
    expect(screen.getByText("Select a conversation")).toBeInTheDocument();
    expect(sidebar().getByRole("button", { name: "Development channel, 3 unread" })).toBeInTheDocument();
    expect(sidebar().getByRole("button", { name: "Rahul Sharma, 2 unread" })).toBeInTheDocument();
    // # General is the live Global Chat; its count comes from the API.
    expect(await sidebar().findByRole("button", { name: "General channel, 4 unread" })).toBeInTheDocument();
  });

  it("opens a conversation through the URL, so Back returns to the list on phones", () => {
    renderChat();
    fireEvent.click(sidebar().getByRole("button", { name: /Priya Patel/ }));
    expect(routerMock.push).toHaveBeenCalledWith("/?c=dm-user-2", { scroll: false });
  });

  it("shows a direct conversation with presence, a New messages divider, and sends locally", async () => {
    renderChat({ c: "dm-user-1" });
    const pane = within(await screen.findByRole("region", { name: "Conversation" }));
    expect(pane.getByRole("heading", { name: "Rahul Sharma" })).toBeInTheDocument();
    expect(pane.getByText("Online")).toBeInTheDocument();
    expect(pane.getByText("Doing great 👍")).toBeInTheDocument();
    expect(pane.getByText("New messages")).toBeInTheDocument();

    const input = pane.getByPlaceholderText("Message Rahul");
    fireEvent.change(input, { target: { value: "On my way to the board now" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(await pane.findByText("On my way to the board now")).toBeInTheDocument();
    expect(input).toHaveValue("");
    // Opening it cleared the unread badge.
    expect(sidebar().getByRole("button", { name: "Rahul Sharma" })).toHaveAttribute("aria-current", "page");
  });

  it("searches people, channels and messages", () => {
    renderChat();
    fireEvent.change(screen.getByRole("searchbox", { name: "Search people or messages" }), { target: { value: "api" } });
    const results = within(screen.getByRole("region", { name: "Search results for api" }));
    expect(results.getByText("Messages")).toBeInTheDocument();
    fireEvent.click(results.getByRole("button", { name: /completed successfully/ }));
    expect(routerMock.push).toHaveBeenCalledWith(expect.stringMatching(/^\/\?c=channel-development&m=mock-/), { scroll: false });
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
    fireEvent.change(dialog.getByRole("searchbox", { name: "Search people" }), { target: { value: "tar" } });
    fireEvent.click(dialog.getByRole("button", { name: /Tarun Joshi/ }));
    expect(routerMock.push).toHaveBeenCalledWith("/?c=dm-user-6", { scroll: false });
    expect(sidebar().getByRole("button", { name: "Tarun Joshi" })).toBeInTheDocument();
  });
});
