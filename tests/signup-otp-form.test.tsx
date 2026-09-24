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

  it("holds the resend button during the 30 second cooldown", () => {
    renderForm();
    expect(screen.getByRole("button", { name: /resend otp \(30s\)/i })).toBeDisabled();
  });

  it("resends once the cooldown is over", async () => {
    const user = userEvent.setup();
    resend.mockResolvedValueOnce(makeChallenge());
    renderForm(makeChallenge({ resendAvailableAt: new Date(Date.now() - 1000).toISOString() }));

    await user.click(screen.getByRole("button", { name: /^resend otp$/i }));

    await waitFor(() => expect(resend).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111"));
    expect(await screen.findByRole("status")).toHaveTextContent(/new code is on its way/i);
  });
});
