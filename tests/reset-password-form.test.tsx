import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { ApiError } from "@/lib/api/client";
import { passwordResetService } from "@/services/password-reset.service";
import { renderWithProviders } from "./utils";

vi.mock("@/services/password-reset.service", () => ({
  passwordResetService: { verifyPasswordResetToken: vi.fn(), resetPassword: vi.fn() },
}));

const verify = vi.mocked(passwordResetService.verifyPasswordResetToken);
const reset = vi.mocked(passwordResetService.resetPassword);

const TOKEN = "a".repeat(43);

async function renderValid() {
  verify.mockResolvedValueOnce({ valid: true, expiresAt: new Date(Date.now() + 60_000).toISOString() });
  renderWithProviders(<ResetPasswordForm token={TOKEN} />, { user: null });
  await screen.findByRole("heading", { name: "Reset Your Password" });
}

describe("ResetPasswordForm", () => {
  beforeEach(() => {
    verify.mockReset();
    reset.mockReset();
  });

  it("shows the invalid-link state without a token and never calls the API", async () => {
    renderWithProviders(<ResetPasswordForm token="" />, { user: null });
    expect(await screen.findByRole("heading", { name: "Reset Link Invalid" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Login" })).toHaveAttribute("href", "/login");
    expect(verify).not.toHaveBeenCalled();
  });

  it("shows the expired state when the API says the link lapsed", async () => {
    verify.mockRejectedValueOnce(new ApiError(410, "PASSWORD_RESET_EXPIRED", "This reset link has expired."));
    renderWithProviders(<ResetPasswordForm token={TOKEN} />, { user: null });
    expect(await screen.findByRole("heading", { name: "Reset Link Expired" })).toBeInTheDocument();
    expect(screen.getByText(/request a new password reset link from your administrator/i)).toBeInTheDocument();
  });

  it("validates strength and confirmation before calling the API", async () => {
    const user = userEvent.setup();
    await renderValid();

    await user.type(screen.getByLabelText(/^new password/i), "weakpass");
    await user.type(screen.getByLabelText(/^confirm password/i), "different");
    await user.click(screen.getByRole("button", { name: "Reset Password" }));

    expect(await screen.findByText("Password does not meet the requirements below")).toBeInTheDocument();
    expect(screen.getByText("Passwords do not match.")).toBeInTheDocument();
    expect(reset).not.toHaveBeenCalled();
  });

  it("toggles password visibility", async () => {
    const user = userEvent.setup();
    await renderValid();
    const input = screen.getByLabelText(/^new password/i);
    expect(input).toHaveAttribute("type", "password");
    await user.click(screen.getByRole("button", { name: "Show new password" }));
    expect(input).toHaveAttribute("type", "text");
  });

  it("resets the password and shows the success state without the password", async () => {
    const user = userEvent.setup();
    reset.mockResolvedValueOnce(undefined);
    await renderValid();

    await user.type(screen.getByLabelText(/^new password/i), "NewPassw0rd!");
    await user.type(screen.getByLabelText(/^confirm password/i), "NewPassw0rd!");
    await user.click(screen.getByRole("button", { name: "Reset Password" }));

    expect(await screen.findByRole("heading", { name: "Password Reset Successfully" })).toBeInTheDocument();
    expect(reset).toHaveBeenCalledWith({ token: TOKEN, newPassword: "NewPassw0rd!", confirmPassword: "NewPassw0rd!" });
    expect(screen.queryByText("NewPassw0rd!")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to Login" })).toHaveAttribute("href", "/login");
  });

  it("switches to the invalid state if the link was spent meanwhile", async () => {
    const user = userEvent.setup();
    reset.mockRejectedValueOnce(new ApiError(400, "PASSWORD_RESET_INVALID", "This password reset link is invalid or expired."));
    await renderValid();

    await user.type(screen.getByLabelText(/^new password/i), "NewPassw0rd!");
    await user.type(screen.getByLabelText(/^confirm password/i), "NewPassw0rd!");
    await user.click(screen.getByRole("button", { name: "Reset Password" }));

    await waitFor(() => expect(screen.getByRole("heading", { name: "Reset Link Invalid" })).toBeInTheDocument());
  });
});
