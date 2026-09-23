import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LoginOtpForm } from "@/components/auth/login-otp-form";
import { ApiError } from "@/lib/api/client";
import { authService, type LoginOtpChallenge } from "@/services/auth.service";
import { makeAuthUser } from "./utils";

vi.mock("@/services/auth.service", () => ({
  authService: { login: vi.fn(), verifyLoginOtp: vi.fn(), resendLoginOtp: vi.fn(), logout: vi.fn(), me: vi.fn() },
}));

const verify = vi.mocked(authService.verifyLoginOtp);
const resend = vi.mocked(authService.resendLoginOtp);

/** A challenge as the API hands it over: code still valid, resend on cooldown. */
function makeChallenge(overrides: Partial<LoginOtpChallenge> = {}): LoginOtpChallenge {
  return {
    requiresOtp: true,
    verificationId: "11111111-1111-4111-8111-111111111111",
    email: "v****@gmail.com",
    expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
    resendAvailableAt: new Date(Date.now() + 60_000).toISOString(),
    expiresInSeconds: 300,
    resendAvailableInSeconds: 60,
    ...overrides,
  };
}

const renderForm = (challenge = makeChallenge(), props: { onSuccess?: () => void; onCancel?: () => void } = {}) => {
  const onSuccess = props.onSuccess ?? vi.fn();
  const onCancel = props.onCancel ?? vi.fn();
  render(<LoginOtpForm challenge={challenge} onSuccess={onSuccess} onCancel={onCancel} />);
  return { onSuccess, onCancel, code: () => screen.getByLabelText(/verification code/i) };
};

describe("LoginOtpForm", () => {
  it("tells the user which mailbox to check without revealing the address", () => {
    renderForm();
    expect(screen.getByText("v****@gmail.com")).toBeInTheDocument();
  });

  it("verifies as soon as the sixth digit is typed", async () => {
    const user = userEvent.setup();
    const authUser = makeAuthUser();
    verify.mockResolvedValueOnce(authUser);
    const { onSuccess, code } = renderForm();

    await user.type(code(), "123456");

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(authUser));
    expect(verify).toHaveBeenCalledWith({ verificationId: "11111111-1111-4111-8111-111111111111", otp: "123456" });
  });

  it("ignores anything that is not a digit", async () => {
    const user = userEvent.setup();
    const { code } = renderForm();

    await user.type(code(), "12ab-34");

    expect(code()).toHaveValue("1234");
    expect(verify).not.toHaveBeenCalled();
  });

  it("keeps the API's remaining-attempts message and clears the field to retry", async () => {
    const user = userEvent.setup();
    verify.mockRejectedValueOnce(new ApiError(401, "LOGIN_OTP_INVALID", "Incorrect code. 4 attempts left."));
    const { onSuccess, code } = renderForm();

    await user.type(code(), "000000");

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Incorrect code. 4 attempts left.");
    // A rejected code is usually a stale one, so the hint matters more than the count.
    expect(alert).toHaveTextContent(/newest email/i);
    expect(code()).toHaveValue("");
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("explains an expired code and points at the resend", async () => {
    const user = userEvent.setup();
    verify.mockRejectedValueOnce(new ApiError(401, "LOGIN_OTP_EXPIRED", "This code has expired. Request a new one."));
    const { code } = renderForm();

    await user.type(code(), "123456");

    expect(await screen.findByRole("alert")).toHaveTextContent(/expired/i);
  });

  it("holds the resend button until the cooldown has elapsed", () => {
    renderForm();
    expect(screen.getByRole("button", { name: /resend in/i })).toBeDisabled();
    expect(resend).not.toHaveBeenCalled();
  });

  it("requests a new code once the cooldown has passed", async () => {
    const user = userEvent.setup();
    const refreshed = makeChallenge({ resendAvailableAt: new Date(Date.now() + 60_000).toISOString() });
    resend.mockResolvedValueOnce(refreshed);
    // Cooldown already elapsed, so the button is live.
    const { code } = renderForm(makeChallenge({ resendAvailableAt: new Date(Date.now() - 1000).toISOString() }));

    await user.click(screen.getByRole("button", { name: /send a new code/i }));

    await waitFor(() => expect(resend).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111"));
    expect(await screen.findByRole("status")).toHaveTextContent(/new code is on its way/i);
    // The new challenge's cooldown applies from here.
    expect(screen.getByRole("button", { name: /resend in/i })).toBeDisabled();
    expect(code()).toHaveValue("");
  });

  it("surfaces the resend limit", async () => {
    const user = userEvent.setup();
    resend.mockRejectedValueOnce(new ApiError(429, "LOGIN_OTP_RESEND_LIMIT", "Too many codes requested. Please sign in again."));
    renderForm(makeChallenge({ resendAvailableAt: new Date(Date.now() - 1000).toISOString() }));

    await user.click(screen.getByRole("button", { name: /send a new code/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/too many codes requested/i);
  });

  it("blocks submission and offers a new code once the code has expired", () => {
    renderForm(makeChallenge({ expiresAt: new Date(Date.now() - 1000).toISOString() }));
    expect(screen.getByRole("button", { name: /verify and sign in/i })).toBeDisabled();
    expect(screen.getByText(/this code has expired/i)).toBeInTheDocument();
  });

  it("lets the user abandon the pending sign-in", async () => {
    const user = userEvent.setup();
    const { onCancel } = renderForm();

    await user.click(screen.getByRole("button", { name: /use a different account/i }));

    expect(onCancel).toHaveBeenCalled();
  });
});
