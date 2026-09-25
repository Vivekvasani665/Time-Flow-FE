import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LoginOtpForm } from "@/components/auth/login-otp-form";
import { OtpLoginRequestForm, toSendOtpInput } from "@/components/auth/otp-login-request-form";
import { ApiError } from "@/lib/api/client";
import { authService, type LoginOtpChallenge } from "@/services/auth.service";
import { makeAuthUser } from "./utils";

vi.mock("@/services/auth.service", () => ({
  authService: { sendOtp: vi.fn(), verifyOtp: vi.fn(), resendOtp: vi.fn(), verifyLoginOtp: vi.fn(), resendLoginOtp: vi.fn(), logout: vi.fn(), me: vi.fn() },
}));

const sendOtp = vi.mocked(authService.sendOtp);

function makeChallenge(overrides: Partial<LoginOtpChallenge> = {}): LoginOtpChallenge {
  return {
    requiresOtp: true,
    verificationId: "tok_abcdefghijklmnopqrstuvwxyz0123456789",
    email: "v****@gmail.com",
    phone: "+91******6141",
    channels: ["email", "sms"],
    delivery: { email: { status: "sent" }, sms: { status: "sent" } },
    expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
    resendAvailableAt: new Date(Date.now() + 30_000).toISOString(),
    expiresInSeconds: 300,
    resendAvailableInSeconds: 30,
    ...overrides,
  };
}

describe("toSendOtpInput", () => {
  it("sends an email as email and a mobile number in E.164", () => {
    expect(toSendOtpInput(" Vivek@Gmail.com ")).toEqual({ email: "Vivek@Gmail.com" });
    expect(toSendOtpInput("+91 81404-46141")).toEqual({ phone: "+918140446141" });
  });
});

describe("OtpLoginRequestForm", () => {
  it("asks the API for a code and hands the token challenge to the parent", async () => {
    const user = userEvent.setup();
    const onSent = vi.fn();
    const challenge = makeChallenge();
    sendOtp.mockResolvedValueOnce(challenge);
    render(<OtpLoginRequestForm onSent={onSent} />);

    await user.type(screen.getByLabelText(/email or mobile number/i), "+91 81404 46141");
    await user.click(screen.getByRole("button", { name: /send otp/i }));

    await waitFor(() => expect(onSent).toHaveBeenCalledWith(challenge));
    expect(sendOtp).toHaveBeenCalledWith({ phone: "+918140446141" });
  });

  it("validates before calling the API", async () => {
    const user = userEvent.setup();
    render(<OtpLoginRequestForm onSent={vi.fn()} />);
    await user.type(screen.getByLabelText(/email or mobile number/i), "98765");
    await user.click(screen.getByRole("button", { name: /send otp/i }));
    expect(await screen.findByText(/mobile number with its country code/i)).toBeInTheDocument();
    expect(sendOtp).not.toHaveBeenCalled();
  });

  it("explains an unknown account and a cooldown", async () => {
    const user = userEvent.setup();
    render(<OtpLoginRequestForm onSent={vi.fn()} />);
    sendOtp.mockRejectedValueOnce(new ApiError(404, "ACCOUNT_NOT_FOUND", "No account found for this email or mobile number."));
    await user.type(screen.getByLabelText(/email or mobile number/i), "nobody@x.co");
    await user.click(screen.getByRole("button", { name: /send otp/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("No account found for this email or mobile number.");
  });
});

describe("LoginOtpForm in the passwordless flow", () => {
  it("verifies token + code through the function it is given", async () => {
    const user = userEvent.setup();
    const authUser = makeAuthUser();
    const verifyCode = vi.fn().mockResolvedValue(authUser);
    const onSuccess = vi.fn();
    render(<LoginOtpForm challenge={makeChallenge()} onSuccess={onSuccess} onCancel={vi.fn()} verifyCode={verifyCode} cancelLabel="Use a different email or number" />);

    await user.type(screen.getByLabelText(/verification code/i), "229152");

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(authUser));
    expect(verifyCode).toHaveBeenCalledWith("tok_abcdefghijklmnopqrstuvwxyz0123456789", "229152");
    expect(authService.verifyLoginOtp).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /use a different email or number/i })).toBeInTheDocument();
  });

  it("says the email and SMS codes differ when the API reports it", () => {
    render(<LoginOtpForm challenge={makeChallenge({ sameCodeOnAllChannels: false })} onSuccess={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText(/each have their own code/i)).toBeInTheDocument();
  });

  it("maps the passwordless error codes", async () => {
    const user = userEvent.setup();
    const verifyCode = vi.fn().mockRejectedValue(new ApiError(401, "OTP_TOKEN_INVALID", "This sign-in code is no longer valid."));
    render(<LoginOtpForm challenge={makeChallenge()} onSuccess={vi.fn()} onCancel={vi.fn()} verifyCode={verifyCode} />);
    await user.type(screen.getByLabelText(/verification code/i), "000000");
    expect(await screen.findByRole("alert")).toHaveTextContent(/no longer valid/i);
  });
});
