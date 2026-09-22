import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoginForm } from "@/components/auth/login-form";
import { formatCountdown } from "@/components/auth/login-otp-form";
import { ApiError } from "@/lib/api/client";
import { authService, type LoginOtpChallenge } from "@/services/auth.service";
import { makeAuthUser } from "./utils";

const { toastSuccess } = vi.hoisted(() => ({ toastSuccess: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: toastSuccess, error: vi.fn() } }));

vi.mock("@/services/auth.service", () => ({
  authService: { login: vi.fn(), loginTwoFactor: vi.fn(), verifyLoginOtp: vi.fn(), resendLoginOtp: vi.fn(), logout: vi.fn(), me: vi.fn() },
}));

const login = vi.mocked(authService.login);
const verifyLoginOtp = vi.mocked(authService.verifyLoginOtp);
const resendLoginOtp = vi.mocked(authService.resendLoginOtp);

const OTP: LoginOtpChallenge = {
  verificationId: "3f1c2d4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f",
  email: "a****@timeflow.dev",
  expiresInSeconds: 300,
  resendAvailableInSeconds: 60,
};

beforeEach(() => {
  vi.clearAllMocks();
});

async function reachOtpStep(challenge: Partial<LoginOtpChallenge> = {}, onSuccess = vi.fn(), onStepChange = vi.fn()) {
  const user = userEvent.setup();
  login.mockResolvedValueOnce({ requiresOtp: true, ...OTP, ...challenge });
  render(<LoginForm onSuccess={onSuccess} onStepChange={onStepChange} />);
  await user.type(screen.getByLabelText(/email/i), "admin@timeflow.dev");
  await user.type(screen.getByLabelText(/^password/i), "Password123!");
  await user.click(screen.getByRole("button", { name: /^sign in$/i }));
  await screen.findByRole("button", { name: /^verify$/i });
  return { user, onSuccess, onStepChange };
}

const typeCode = async (user: ReturnType<typeof userEvent.setup>, code: string) => {
  await user.click(screen.getByLabelText("Digit 1 of 6"));
  await user.keyboard(code);
};

describe("Login OTP step", () => {
  it("formats the countdown as mm:ss", () => {
    expect(formatCountdown(300)).toBe("05:00");
    expect(formatCountdown(299)).toBe("04:59");
    expect(formatCountdown(7)).toBe("00:07");
    expect(formatCountdown(-3)).toBe("00:00");
  });

  it("stays on the password step unless the server asks for a code", async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    const authUser = makeAuthUser();
    login.mockResolvedValueOnce({ twoFactorRequired: false, user: authUser });
    render(<LoginForm onSuccess={onSuccess} />);
    await user.type(screen.getByLabelText(/email/i), "admin@timeflow.dev");
    await user.type(screen.getByLabelText(/^password/i), "Password123!");
    await user.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(authUser));
    expect(screen.queryByRole("button", { name: /^verify$/i })).not.toBeInTheDocument();
  });

  it("shows where the code went and the countdown, then signs in with the code", async () => {
    const authUser = makeAuthUser();
    verifyLoginOtp.mockResolvedValueOnce(authUser);
    const { user, onSuccess, onStepChange } = await reachOtpStep();

    expect(onStepChange).toHaveBeenCalledWith("otp");
    expect(screen.getByText(OTP.email)).toBeInTheDocument();
    expect(screen.getByText(/code expires in 0[45]:[0-5]\d/i)).toBeInTheDocument();
    const verify = screen.getByRole("button", { name: /^verify$/i });
    expect(verify).toBeDisabled();

    await typeCode(user, "482913");
    expect(screen.getByLabelText("Digit 6 of 6")).toHaveValue("3");
    await user.click(verify);

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(authUser));
    expect(verifyLoginOtp).toHaveBeenCalledWith(OTP.verificationId, "482913");
  });

  it("fills every box from a pasted code", async () => {
    const { user } = await reachOtpStep();
    await user.click(screen.getByLabelText("Digit 1 of 6"));
    await user.paste("12 34 56");
    expect(["1", "2", "3", "4", "5", "6"].map((_, i) => (screen.getByLabelText(`Digit ${i + 1} of 6`) as HTMLInputElement).value).join("")).toBe("123456");
  });

  it("explains a wrong code with the attempts left", async () => {
    verifyLoginOtp.mockRejectedValueOnce(new ApiError(401, "LOGIN_OTP_INVALID", "Incorrect code. 4 attempts left."));
    const { user } = await reachOtpStep();
    await typeCode(user, "000000");
    await user.click(screen.getByRole("button", { name: /^verify$/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid verification code. Please try again. 4 attempts left.");
  });

  it("locks Verify after too many attempts until a new code is requested", async () => {
    verifyLoginOtp.mockRejectedValueOnce(new ApiError(429, "LOGIN_OTP_TOO_MANY_ATTEMPTS", "Too many incorrect codes."));
    resendLoginOtp.mockResolvedValueOnce({ ...OTP, resendAvailableInSeconds: 60 });
    const { user } = await reachOtpStep({ resendAvailableInSeconds: 0 });
    await typeCode(user, "000000");
    await user.click(screen.getByRole("button", { name: /^verify$/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Too many incorrect attempts. Please request a new code.");
    expect(screen.getByLabelText("Digit 1 of 6")).toBeDisabled();

    await user.click(screen.getByRole("button", { name: /^resend otp$/i }));
    await waitFor(() => expect(screen.getByLabelText("Digit 1 of 6")).toBeEnabled());
    expect(resendLoginOtp).toHaveBeenCalledWith(OTP.verificationId);
    expect(toastSuccess).toHaveBeenCalledWith("New verification code sent.", expect.anything());
    // The countdown restarts and the next resend waits out its cooldown.
    expect(screen.getByRole("button", { name: /resend available in \d+s/i })).toBeDisabled();
  });

  it("counts down to 'Code expired' and disables Verify", async () => {
    const { user } = await reachOtpStep({ expiresInSeconds: 1 });
    await typeCode(user, "123");
    await waitFor(() => expect(screen.getByText("Code expired")).toBeInTheDocument(), { timeout: 3000 });
    expect(screen.getByRole("button", { name: /^verify$/i })).toBeDisabled();
  });

  it("holds Resend during the cooldown", async () => {
    await reachOtpStep();
    expect(screen.getByRole("button", { name: /resend available in (59|60)s/i })).toBeDisabled();
  });

  it("reports a failed email on resend without leaving the step", async () => {
    resendLoginOtp.mockRejectedValueOnce(new ApiError(503, "EMAIL_DELIVERY_FAILED", "SMTP said no"));
    const { user } = await reachOtpStep({ resendAvailableInSeconds: 0 });
    await user.click(screen.getByRole("button", { name: /^resend otp$/i }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/couldn't send the verification email/i);
    expect(alert).not.toHaveTextContent("SMTP");
  });

  it("shows a friendly message for a network failure", async () => {
    verifyLoginOtp.mockRejectedValueOnce(new ApiError(0, "NETWORK_ERROR", "Connection lost."));
    const { user } = await reachOtpStep();
    await typeCode(user, "123456");
    await user.click(screen.getByRole("button", { name: /^verify$/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to verify the code. Please check your connection and try again.");
  });

  it("never shows raw server errors", async () => {
    verifyLoginOtp.mockRejectedValueOnce(new ApiError(500, "INTERNAL_ERROR", "PrismaClientKnownRequestError: connection refused"));
    const { user } = await reachOtpStep();
    await typeCode(user, "123456");
    await user.click(screen.getByRole("button", { name: /^verify$/i }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Something went wrong. Please try again later.");
    expect(alert).not.toHaveTextContent(/prisma/i);
  });

  it("returns to the password step when the sign-in attempt is no longer valid", async () => {
    verifyLoginOtp.mockRejectedValueOnce(new ApiError(401, "LOGIN_OTP_SESSION_INVALID", "no longer valid"));
    const { user, onStepChange } = await reachOtpStep();
    await typeCode(user, "123456");
    await user.click(screen.getByRole("button", { name: /^verify$/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/sign-in session has expired/i);
    expect(screen.getByLabelText(/^password/i)).toHaveValue("");
    expect(onStepChange).toHaveBeenLastCalledWith("credentials");
  });

  it("does not persist the code in browser storage", async () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    verifyLoginOtp.mockResolvedValueOnce(makeAuthUser());
    const { user } = await reachOtpStep();
    await typeCode(user, "482913");
    await user.click(screen.getByRole("button", { name: /^verify$/i }));
    await waitFor(() => expect(verifyLoginOtp).toHaveBeenCalled());
    expect(setItem.mock.calls.flat().join(" ")).not.toContain("482913");
    setItem.mockRestore();
  });
  it("asks for a new code when the code has expired server-side", async () => {
    verifyLoginOtp.mockRejectedValueOnce(new ApiError(401, "LOGIN_OTP_EXPIRED", "This code has expired."));
    const { user } = await reachOtpStep();
    await typeCode(user, "123456");
    await user.click(screen.getByRole("button", { name: /^verify$/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Your verification code has expired. Please request a new code.");
    expect(screen.getByLabelText("Digit 1 of 6")).toBeDisabled();
  });

  it("explains a rate limit without leaving the step", async () => {
    verifyLoginOtp.mockRejectedValueOnce(new ApiError(429, "RATE_LIMITED", "Too many code attempts."));
    const { user } = await reachOtpStep();
    await typeCode(user, "123456");
    await user.click(screen.getByRole("button", { name: /^verify$/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Too many requests. Please wait and try again.");
    expect(screen.getByRole("button", { name: /^verify$/i })).toBeInTheDocument();
  });

  it("goes back to the password step without signing in", async () => {
    const { user, onSuccess, onStepChange } = await reachOtpStep();
    await typeCode(user, "123");
    await user.click(screen.getByRole("button", { name: /back to login/i }));

    expect(screen.getByRole("button", { name: /^sign in$/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/^password/i)).toHaveValue("");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(onStepChange).toHaveBeenLastCalledWith("credentials");
    expect(onSuccess).not.toHaveBeenCalled();
    expect(verifyLoginOtp).not.toHaveBeenCalled();
  });

  it("moves between boxes with Backspace and ignores letters", async () => {
    const { user } = await reachOtpStep();
    await typeCode(user, "1a2");
    expect(screen.getByLabelText("Digit 2 of 6")).toHaveValue("2");
    expect(screen.getByLabelText("Digit 3 of 6")).toHaveFocus();
    await user.keyboard("{Backspace}");
    expect(screen.getByLabelText("Digit 2 of 6")).toHaveValue("");
    expect(screen.getByLabelText("Digit 2 of 6")).toHaveFocus();
  });
});
