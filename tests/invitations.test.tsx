import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AcceptInvitationForm } from "@/components/invitations/accept-invitation-form";
import { InviteUser } from "@/components/invitations/invite-user";
import { ApiError } from "@/lib/api/client";
import { invitationsService } from "@/services/invitations.service";
import { rolesService } from "@/services/roles.service";
import { routerMock } from "./setup";
import { makeAuthUser, renderWithProviders } from "./utils";

vi.mock("@/services/invitations.service", () => ({
  invitationsService: { create: vi.fn(), verify: vi.fn(), accept: vi.fn() },
}));
vi.mock("@/services/roles.service", () => ({ rolesService: { list: vi.fn() } }));

const create = vi.mocked(invitationsService.create);
const verify = vi.mocked(invitationsService.verify);
const accept = vi.mocked(invitationsService.accept);
const listRoles = vi.mocked(rolesService.list);

const TOKEN = "t".repeat(43);
const ROLE = { id: "22222222-2222-4222-8222-222222222222", name: "Employee" };
const superAdmin = makeAuthUser(undefined, { role: { id: "role-sa", name: "Super Admin" } });

async function pickRole() {
  const trigger = await screen.findByRole("combobox");
  await waitFor(() => expect(trigger).not.toBeDisabled());
  fireEvent.keyDown(trigger, { key: "Enter" });
  fireEvent.click(await screen.findByRole("option", { name: ROLE.name }));
}

describe("InviteUser", () => {
  beforeEach(() => {
    listRoles.mockResolvedValue({
      items: [{ ...ROLE, description: null, isSystem: false, permissions: [], userCount: 0, createdAt: "", updatedAt: "" }],
      meta: { page: 1, limit: 100, total: 1, totalPages: 1 },
    });
  });

  it("validates email and role before calling the API", async () => {
    const user = userEvent.setup();
    renderWithProviders(<InviteUser />, { user: superAdmin });
    await user.type(screen.getByLabelText(/email address/i), "not-an-email");
    await user.click(screen.getByRole("button", { name: "Generate Invitation Link" }));
    expect(await screen.findByText("Enter a valid email address")).toBeInTheDocument();
    expect(screen.getByText("Select a role")).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
  });

  it("generates a link from the API response and copies it", async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    const inviteUrl = `http://localhost:3000/accept-invitation?token=${TOKEN}`;
    create.mockResolvedValueOnce({
      inviteUrl,
      invitation: {
        id: "i1",
        email: "new@example.com",
        status: "PENDING",
        expiresAt: new Date(Date.now() + 72 * 3_600_000).toISOString(),
        acceptedAt: null,
        revokedAt: null,
        createdAt: new Date().toISOString(),
        role: ROLE,
        invitedBy: null,
        acceptedUser: null,
      },
    });
    renderWithProviders(<InviteUser />, { user: superAdmin });

    await user.type(screen.getByLabelText(/email address/i), "  New@Example.com ");
    await pickRole();
    await user.click(screen.getByRole("button", { name: "Generate Invitation Link" }));

    expect(await screen.findByRole("heading", { name: "Invitation Link Generated" })).toBeInTheDocument();
    expect(create).toHaveBeenCalledWith({ email: "new@example.com", roleId: ROLE.id });
    expect(screen.getByLabelText("Invitation Link")).toHaveValue(inviteUrl);
    expect(screen.getByText(/expires in 72 hours/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Copy" }));
    expect(writeText).toHaveBeenCalledWith(inviteUrl);
    expect(await screen.findByRole("button", { name: "Copied" })).toBeInTheDocument();
  });

  it("shows a friendly message when the email is already registered", async () => {
    const user = userEvent.setup();
    create.mockRejectedValueOnce(new ApiError(409, "USER_EMAIL_EXISTS", "A user with this email already exists"));
    renderWithProviders(<InviteUser />, { user: superAdmin });
    await user.type(screen.getByLabelText(/email address/i), "taken@example.com");
    await pickRole();
    await user.click(screen.getByRole("button", { name: "Generate Invitation Link" }));
    expect(await screen.findByText("User with this email already exists.")).toBeInTheDocument();
  });

  it("hides raw server errors", async () => {
    const user = userEvent.setup();
    create.mockRejectedValueOnce(new ApiError(500, "INTERNAL_ERROR", "stack trace here"));
    renderWithProviders(<InviteUser />, { user: superAdmin });
    await user.type(screen.getByLabelText(/email address/i), "x@example.com");
    await pickRole();
    await user.click(screen.getByRole("button", { name: "Generate Invitation Link" }));
    expect(await screen.findByText("Something went wrong on our end. Please try again shortly.")).toBeInTheDocument();
    expect(screen.queryByText("stack trace here")).not.toBeInTheDocument();
  });
});

async function renderValidInvite() {
  verify.mockResolvedValueOnce({ valid: true, email: "new@example.com", role: ROLE, expiresAt: new Date(Date.now() + 60_000).toISOString() });
  renderWithProviders(<AcceptInvitationForm token={TOKEN} />, { user: null });
  await screen.findByRole("heading", { name: "Welcome to TimeFlow" });
}

describe("AcceptInvitationForm", () => {
  it("shows the expired state without a token and never calls the API", async () => {
    renderWithProviders(<AcceptInvitationForm token="" />, { user: null });
    expect(await screen.findByRole("heading", { name: "Invitation Link Expired" })).toBeInTheDocument();
    expect(verify).not.toHaveBeenCalled();
  });

  it("shows the expired state instead of the form when the API rejects the link", async () => {
    verify.mockRejectedValueOnce(new ApiError(410, "INVITATION_LINK_INVALID", "Invitation Link Expired or Already Used"));
    renderWithProviders(<AcceptInvitationForm token={TOKEN} />, { user: null });
    expect(await screen.findByRole("heading", { name: "Invitation Link Expired" })).toBeInTheDocument();
    expect(screen.queryByLabelText(/^new password/i)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to Login" })).toHaveAttribute("href", "/login");
  });

  it("shows the invited email read-only with the role", async () => {
    await renderValidInvite();
    const email = screen.getByLabelText("Email");
    expect(email).toHaveValue("new@example.com");
    expect(email).toHaveAttribute("readonly");
    expect(screen.getByText("Employee")).toBeInTheDocument();
  });

  it("validates strength and confirmation before calling the API", async () => {
    const user = userEvent.setup();
    await renderValidInvite();
    await user.type(screen.getByLabelText(/^new password/i), "weakpass");
    await user.type(screen.getByLabelText(/^confirm password/i), "different");
    await user.click(screen.getByRole("button", { name: "Set Password" }));
    expect(await screen.findByText("Password does not meet the requirements below")).toBeInTheDocument();
    expect(screen.getByText("Passwords do not match.")).toBeInTheDocument();
    expect(accept).not.toHaveBeenCalled();
  });

  it("sets the password, shows success and redirects to login", async () => {
    const user = userEvent.setup();
    accept.mockResolvedValueOnce(undefined);
    await renderValidInvite();
    await user.type(screen.getByLabelText(/^new password/i), "NewPassw0rd!");
    await user.type(screen.getByLabelText(/^confirm password/i), "NewPassw0rd!");
    await user.click(screen.getByRole("button", { name: "Set Password" }));

    expect(await screen.findByRole("heading", { name: "Password Set Successfully" })).toBeInTheDocument();
    expect(accept).toHaveBeenCalledWith({ token: TOKEN, password: "NewPassw0rd!", confirmPassword: "NewPassw0rd!" });
    expect(screen.queryByText("NewPassw0rd!")).not.toBeInTheDocument();
    await waitFor(() => expect(routerMock.replace).toHaveBeenCalledWith("/login"), { timeout: 3000 });
  });

  it("switches to the expired state if the link dies before submit", async () => {
    const user = userEvent.setup();
    accept.mockRejectedValueOnce(new ApiError(410, "INVITATION_LINK_INVALID", "Invitation Link Expired or Already Used"));
    await renderValidInvite();
    await user.type(screen.getByLabelText(/^new password/i), "NewPassw0rd!");
    await user.type(screen.getByLabelText(/^confirm password/i), "NewPassw0rd!");
    await user.click(screen.getByRole("button", { name: "Set Password" }));
    expect(await screen.findByRole("heading", { name: "Invitation Link Expired" })).toBeInTheDocument();
  });
});
