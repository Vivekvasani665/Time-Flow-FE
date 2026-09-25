import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SignupOtpForm } from "@/components/auth/signup-otp-form";
import { ApiError } from "@/lib/api/client";
import { authService, type SignupOtpChallenge } from "@/services/auth.service";
import { makeAuthUser } from "./utils";

vi.mock("@/services/auth.service", () => ({
  authService: { verifySignupOtp: vi.fn(), resendSignupOtp: vi.fn(), logout: vi.fn(), me: vi.fn() },
}));

const verify = vi.mocked(authService.verifySignupOtp);
const resend = vi.mocked(authService.resendSignupOtp);

function makeChallenge(overrides: Partial<SignupOtpChallenge> = {}): SignupOtpChallenge {
  return {
    verificationId: "11111111-1111-4111-8111-111111111111",
    email: "s**@company.com",
    phone: "+91******3210",
    channels: ["email", "sms"],
    delivery: { email: { status: "sent" }, sms: { status: "sent" } },
    expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
    resendAvailableAt: new Date(Date.now() + 30_000).toISOString(),
    ...overrides,
  };
}

const renderForm = (challenge = makeChallenge()) => {
  const onSuccess = vi.fn();
  render(<SignupOtpForm challenge={challenge} onSuccess={onSuccess} onCancel={vi.fn()} />);
  return { onSuccess, code: () => screen.getByLabelText(/verification code/i) };
};

describe("SignupOtpForm", () => {
  it("shows the masked email and mobile number the code went to", () => {
    renderForm();
    expect(screen.getByText("Sent to s**@company.com")).toBeInTheDocument();
    expect(screen.getByText("Sent to +91******3210")).toBeInTheDocument();
  });

  it("verifies a pasted code as soon as it is complete", async () => {
    const user = userEvent.setup();
    const authUser = makeAuthUser();
    verify.mockResolvedValueOnce(authUser);
    const { onSuccess, code } = renderForm();

    await user.click(code());
    await user.paste("482 913");

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(authUser));
    expect(verify).toHaveBeenCalledWith({ verificationId: "11111111-1111-4111-8111-111111111111", otp: "482913" });
  });

  it("keeps the API's remaining-attempts message and clears the field", async () => {
    const user = userEvent.setup();
    verify.mockRejectedValueOnce(new ApiError(400, "SIGNUP_OTP_INVALID", "Incorrect code. 4 attempts left."));
    const { onSuccess, code } = renderForm();

    await user.type(code(), "000000");

    expect(await screen.findByRole("alert")).toHaveTextContent("Incorrect code. 4 attempts left.");
    expect(code()).toHaveValue("");
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("holds both resend buttons during the 30 second cooldown", () => {
    renderForm();
    expect(screen.getByRole("button", { name: /resend email otp \(30s\)/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /resend sms otp \(30s\)/i })).toBeDisabled();
  });

  it("resends by SMS only once the cooldown is over", async () => {
    const user = userEvent.setup();
    resend.mockResolvedValueOnce(makeChallenge({ channels: ["sms"], delivery: { sms: { status: "sent" } } }));
    renderForm(makeChallenge({ resendAvailableAt: new Date(Date.now() - 1000).toISOString() }));

    await user.click(screen.getByRole("button", { name: /^resend sms otp$/i }));

    await waitFor(() => expect(resend).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111", "sms"));
    expect(await screen.findByRole("status")).toHaveTextContent(/new code was sent by sms/i);
    expect(screen.getByText("Newest code not sent here")).toBeInTheDocument();
  });

  it("explains that the account exists when only the SMS failed", () => {
    renderForm(makeChallenge({ channels: ["email"], delivery: { email: { status: "sent" }, sms: { status: "failed", code: "SMS_NOT_CONFIGURED" } } }));
    expect(screen.getByText("Sent to s**@company.com")).toBeInTheDocument();
    expect(screen.getByText(/SMS is not set up on the server yet/i)).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Your account was created, but we couldn't send the SMS verification code.");
  });

  it("names a provider authentication failure without leaking provider details", () => {
    renderForm(makeChallenge({ channels: ["email"], delivery: { email: { status: "sent" }, sms: { status: "failed", code: "SMS_PROVIDER_AUTH_FAILED" } } }));
    expect(screen.getByText(/SMS provider authentication failed/i)).toBeInTheDocument();
  });

  it("shows why a resend could not be delivered", async () => {
    const user = userEvent.setup();
    resend.mockRejectedValueOnce(
      new ApiError(503, "OTP_DELIVERY_FAILED", "We could not send your verification code.", [{ path: "sms", message: "SMS_SEND_FAILED" }]),
    );
    renderForm(makeChallenge({ resendAvailableAt: new Date(Date.now() - 1000).toISOString() }));
    await user.click(screen.getByRole("button", { name: /^resend sms otp$/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("SMS verification code could not be sent. Try again in a moment.");
  });
});
