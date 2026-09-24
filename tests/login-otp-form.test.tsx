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
  it("with an email-only challenge, shows just the masked mailbox", () => {
    renderForm();
    expect(screen.getByText("Sent to v****@gmail.com")).toBeInTheDocument();
    expect(screen.queryByText(/^SMS$/)).not.toBeInTheDocument();
  });

  it("shows both masked destinations and says the same code went to each", () => {
    renderForm(
      makeChallenge({
        phone: "+91******3210",
        channels: ["email", "sms"],
        delivery: { email: { status: "sent" }, sms: { status: "sent" } },
        emailSent: true,
        smsSent: true,
      }),
    );
    expect(screen.getByText("Sent to v****@gmail.com")).toBeInTheDocument();
    expect(screen.getByText("Sent to +91******3210")).toBeInTheDocument();
    expect(screen.getByText(/same code in both/i)).toBeInTheDocument();
    // One code, so one input.
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
  });

  it("explains an SMS that could not be sent while the email code still works", () => {
    renderForm(
      makeChallenge({
        phone: "+91******3210",
        channels: ["email"],
        delivery: { email: { status: "sent" }, sms: { status: "failed", code: "SMS_PROVIDER_UNAVAILABLE" } },
        emailSent: true,
        smsSent: false,
      }),
    );
    expect(screen.getByText(/SMS service is unavailable/i)).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/couldn't send the SMS verification code/i);
    expect(screen.queryByText(/same code in both/i)).not.toBeInTheDocument();
  });

  it("names each failed channel when no code could be sent on resend", async () => {
    const user = userEvent.setup();
    resend.mockRejectedValueOnce(
      new ApiError(503, "OTP_DELIVERY_FAILED", "We could not send your verification code.", [
        { path: "email", message: "EMAIL_DELIVERY_FAILED" },
        { path: "sms", message: "SMS_DELIVERY_FAILED" },
      ]),
    );
    renderForm(makeChallenge({ resendAvailableAt: new Date(Date.now() - 1000).toISOString() }));

    await user.click(screen.getByRole("button", { name: /^resend code$/i }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/email verification code could not be sent/i);
    expect(alert).toHaveTextContent(/SMS verification code could not be sent/i);
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
    expect(screen.getByRole("button", { name: /resend code in/i })).toBeDisabled();
    expect(resend).not.toHaveBeenCalled();
  });

  it("requests a new code once the cooldown has passed", async () => {
    const user = userEvent.setup();
    const refreshed = makeChallenge({ resendAvailableAt: new Date(Date.now() + 60_000).toISOString() });
    resend.mockResolvedValueOnce(refreshed);
    // Cooldown already elapsed, so the button is live.
    const { code } = renderForm(makeChallenge({ resendAvailableAt: new Date(Date.now() - 1000).toISOString() }));

    await user.click(screen.getByRole("button", { name: /^resend code$/i }));

    await waitFor(() => expect(resend).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111"));
    expect(await screen.findByRole("status")).toHaveTextContent(/new code was sent to your email\./i);
    // The new challenge's cooldown applies from here.
    expect(screen.getByRole("button", { name: /resend code in/i })).toBeDisabled();
    expect(code()).toHaveValue("");
  });

  it("surfaces the resend limit", async () => {
    const user = userEvent.setup();
    resend.mockRejectedValueOnce(new ApiError(429, "LOGIN_OTP_RESEND_LIMIT", "Too many codes requested. Please sign in again."));
    renderForm(makeChallenge({ resendAvailableAt: new Date(Date.now() - 1000).toISOString() }));

    await user.click(screen.getByRole("button", { name: /^resend code$/i }));

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
