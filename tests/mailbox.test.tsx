import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Mailbox } from "@/components/emails/mailbox";
import { emailService } from "@/services/email.service";
import type { EmailDetail, EmailLog } from "@/types/api";
import { setSearchParams } from "./setup";
import { makeAuthUser, renderWithProviders } from "./utils";

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }), Toaster: () => null }));
vi.mock("@/services/email.service", () => ({
  emailService: { list: vi.fn(), get: vi.fn(), send: vi.fn(), stats: vi.fn(), markRead: vi.fn(), remove: vi.fn(), syncInbox: vi.fn() },
}));
vi.mock("@/services/users.service", () => ({ usersService: { options: vi.fn().mockResolvedValue([]) } }));

const ME = makeAuthUser();
const SENDER = { id: "33333333-3333-4333-8333-333333333333", firstName: "Kai", lastName: "Morgan", email: "kai@timeflow.dev", avatarUrl: null };

const MESSAGE: EmailLog = {
  id: "44444444-4444-4444-8444-444444444444",
  to: ME.email,
  fromAddress: "TimeFlow <no-reply@timeflow.dev>",
  fromName: null,
  direction: "OUTBOUND",
  subject: "Standup notes",
  template: "message",
  status: "SENT",
  attempts: 1,
  lastError: null,
  readAt: null,
  sentAt: "2026-03-01T09:00:00.000Z",
  createdAt: "2026-03-01T09:00:00.000Z",
  toUser: { id: ME.id, firstName: ME.firstName, lastName: ME.lastName, email: ME.email, avatarUrl: null },
  fromUser: SENDER,
};

const DETAIL: EmailDetail = {
  ...MESSAGE,
  bodyHtml: null,
  bodyText: "Shipping today.",
  jobId: null,
  toUserId: ME.id,
  fromUserId: SENDER.id,
  replyToId: null,
  replyTo: null,
};

beforeEach(() => {
  vi.mocked(emailService.list).mockResolvedValue({ items: [MESSAGE], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } });
  vi.mocked(emailService.get).mockResolvedValue(DETAIL);
  vi.mocked(emailService.markRead).mockResolvedValue({ success: true, data: { id: DETAIL.id, readAt: new Date().toISOString() } });
  // The reading pane is driven by the URL, as it is in the app.
  setSearchParams({ selected: DETAIL.id });
});

describe("Mailbox reading pane", () => {
  it("opens a message, marks it read and offers Reply and Delete", async () => {
    renderWithProviders(<Mailbox />, { user: ME });

    expect(await screen.findByRole("heading", { name: "Standup notes" })).toBeInTheDocument();
    expect(screen.getByText("Shipping today.")).toBeInTheDocument();
    // Opening someone's own unread mail marks it read.
    await waitFor(() => expect(emailService.markRead).toHaveBeenCalledWith(DETAIL.id, true));

    expect(screen.getByRole("button", { name: /reply/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /delete message/i })).toBeInTheDocument();
  });

  it("prefills a reply to the other party and threads it under the original", async () => {
    const user = userEvent.setup();
    vi.mocked(emailService.send).mockResolvedValue({ success: true, data: { id: "55555555-5555-4555-8555-555555555555" } });
    renderWithProviders(<Mailbox />, { user: ME });

    await user.click(await screen.findByRole("button", { name: /reply/i }));

    const dialog = await screen.findByRole("dialog", { name: /reply/i });
    expect(within(dialog).getByLabelText(/subject/i)).toHaveValue("Re: Standup notes");
    // The original is quoted, the way a mail client does it.
    const draft = within(dialog).getByLabelText(/message/i) as HTMLTextAreaElement;
    expect(draft.value).toContain("Kai Morgan wrote:");
    expect(draft.value).toContain("> Shipping today.");

    await user.click(within(dialog).getByRole("button", { name: /^send$/i }));

    await waitFor(() =>
      expect(emailService.send).toHaveBeenCalledWith(
        expect.objectContaining({ toUserId: SENDER.id, subject: "Re: Standup notes", replyToId: DETAIL.id }),
      ),
    );
  });

  it("confirms before deleting, then clears the reading pane", async () => {
    const user = userEvent.setup();
    vi.mocked(emailService.remove).mockResolvedValue({ success: true, data: null });
    renderWithProviders(<Mailbox />, { user: ME });

    await user.click(await screen.findByRole("button", { name: /delete message/i }));

    const dialog = await screen.findByRole("dialog", { name: /delete this message/i });
    expect(within(dialog).getByText("Standup notes")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: /^delete$/i }));

    await waitFor(() => expect(emailService.remove).toHaveBeenCalledWith(DETAIL.id));
    expect(toast.success).toHaveBeenCalledWith("Message deleted");
  });

  it("cancelling the confirmation deletes nothing", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Mailbox />, { user: ME });

    await user.click(await screen.findByRole("button", { name: /delete message/i }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: /cancel/i }));

    expect(emailService.remove).not.toHaveBeenCalled();
  });

  it("offers no Reply on system mail, which has no author to answer", async () => {
    vi.mocked(emailService.get).mockResolvedValue({ ...DETAIL, fromUser: null, fromUserId: null });
    renderWithProviders(<Mailbox />, { user: ME });

    expect(await screen.findByRole("heading", { name: "Standup notes" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /reply/i })).not.toBeInTheDocument();
  });
});

/** A reply someone sent back by email to mail ME sent. */
const RECEIVED: EmailDetail = {
  ...DETAIL,
  id: "66666666-6666-4666-8666-666666666666",
  subject: "Re: Proposal",
  template: "inbound",
  direction: "INBOUND",
  to: "team@gmail.com",
  fromAddress: "casey@example.com",
  fromName: "Casey Client",
  fromUser: null,
  fromUserId: null,
  bodyText: "Sounds good.",
  replyToId: "77777777-7777-4777-8777-777777777777",
  replyTo: { id: "77777777-7777-4777-8777-777777777777", subject: "Proposal", createdAt: "2026-03-01T08:00:00.000Z" },
};

describe("Mailbox — replies received by email", () => {
  beforeEach(() => {
    vi.mocked(emailService.list).mockResolvedValue({ items: [RECEIVED], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } });
    vi.mocked(emailService.get).mockResolvedValue(RECEIVED);
    setSearchParams({ selected: RECEIVED.id });
  });

  it("names the outside sender and marks the message as received", async () => {
    renderWithProviders(<Mailbox />, { user: ME });

    expect(await screen.findByRole("heading", { name: "Re: Proposal" })).toBeInTheDocument();
    // Listed under the sender's name, not as system mail.
    expect(screen.getByText("Casey Client")).toBeInTheDocument();
    expect(screen.queryByText("TimeFlow")).not.toBeInTheDocument();
    expect(screen.getByText(/Casey Client ·/)).toBeInTheDocument();
    expect(screen.getAllByText("RECEIVED").length).toBeGreaterThan(0);
  });

  it("answers by email, to the address the reply came from", async () => {
    const user = userEvent.setup();
    vi.mocked(emailService.send).mockResolvedValue({ success: true, data: { id: "88888888-8888-4888-8888-888888888888" } });
    renderWithProviders(<Mailbox />, { user: ME });

    await user.click(await screen.findByRole("button", { name: /reply/i }));
    const dialog = await screen.findByRole("dialog", { name: /reply/i });
    const to = within(dialog).getByLabelText(/^to/i);
    expect(to).toHaveValue("casey@example.com");
    expect(to).toBeDisabled();
    expect((within(dialog).getByLabelText(/message/i) as HTMLTextAreaElement).value).toContain("Casey Client wrote:");

    await user.click(within(dialog).getByRole("button", { name: /^send$/i }));
    await waitFor(() =>
      expect(emailService.send).toHaveBeenCalledWith(
        expect.objectContaining({ toEmail: "casey@example.com", subject: "Re: Proposal", replyToId: RECEIVED.id }),
      ),
    );
    expect(emailService.send).toHaveBeenCalledWith(expect.not.objectContaining({ toUserId: expect.anything() }));
  });

  it("offers no Reply to someone else's received mail seen through All Mail", async () => {
    vi.mocked(emailService.get).mockResolvedValue({ ...RECEIVED, toUserId: "99999999-9999-4999-8999-999999999999", toUser: null });
    renderWithProviders(<Mailbox />, { user: ME });

    expect(await screen.findByRole("heading", { name: "Re: Proposal" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /reply/i })).not.toBeInTheDocument();
  });

  it("syncs the inbox on request", async () => {
    const user = userEvent.setup();
    vi.mocked(emailService.syncInbox).mockResolvedValue({ success: true, data: { queued: true } });
    renderWithProviders(<Mailbox />, { user: ME });

    await user.click(await screen.findByRole("button", { name: /sync inbox/i }));
    await waitFor(() => expect(emailService.syncInbox).toHaveBeenCalled());
    expect(toast.success).toHaveBeenCalledWith("Syncing inbox", expect.anything());
  });
});
