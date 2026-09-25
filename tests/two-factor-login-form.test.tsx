import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TwoFactorLoginForm } from "@/components/auth/two-factor-login-form";
import { ApiError } from "@/lib/api/client";
import { PasskeyCancelledError, provePasskey } from "@/lib/passkeys";
import { authService, type TwoFactorChallenge } from "@/services/auth.service";
import { makeAuthUser } from "./utils";

vi.mock("@/services/auth.service", () => ({
  authService: { login: vi.fn(), verifyTwoFactorLogin: vi.fn(), passkeyLoginOptions: vi.fn(), loginWithPasskey: vi.fn(), logout: vi.fn(), me: vi.fn() },
}));

vi.mock("@/lib/passkeys", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/passkeys")>()),
  passkeysSupported: () => true,
  provePasskey: vi.fn(),
}));

const verify = vi.mocked(authService.verifyTwoFactorLogin);

const challenge: TwoFactorChallenge = {
  twoFactorRequired: true,
  challengeToken: "challenge-token",
  challengeExpiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
};

const renderForm = () => {
  const onSuccess = vi.fn();
  const onCancel = vi.fn();
  render(<TwoFactorLoginForm challenge={challenge} onSuccess={onSuccess} onCancel={onCancel} />);
  const digits = () => screen.getAllByRole("textbox", { name: /digit \d of 6/i });
  return { onSuccess, onCancel, digits };
};

describe("TwoFactorLoginForm", () => {
  it("focuses the first box and signs in as soon as the sixth digit lands", async () => {
    const user = userEvent.setup();
    const authUser = makeAuthUser();
    verify.mockResolvedValueOnce({ user: authUser });
    const { onSuccess, digits } = renderForm();

    expect(digits()[0]).toHaveFocus();
    await user.keyboard("482915");

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(authUser));
    expect(verify).toHaveBeenCalledWith({ challengeToken: "challenge-token", code: "482915" });
  });

  it("offers no way to resend a code — the app makes them", () => {
    renderForm();
    expect(screen.queryByRole("button", { name: /resend|send code/i })).not.toBeInTheDocument();
  });

  it("fills every box from a pasted code, ignoring non-digits", async () => {
    const user = userEvent.setup();
    verify.mockResolvedValueOnce({ user: makeAuthUser() });
    const { digits } = renderForm();

    await user.click(digits()[0]!);
    await user.paste("482 915");

    expect(digits().map((d) => (d as HTMLInputElement).value).join("")).toBe("482915");
    await waitFor(() => expect(verify).toHaveBeenCalledWith({ challengeToken: "challenge-token", code: "482915" }));
  });

  it("rejects letters and moves back with Backspace", async () => {
    const user = userEvent.setup();
    const { digits } = renderForm();

    await user.keyboard("4a8");
    expect(digits().map((d) => (d as HTMLInputElement).value)).toEqual(["4", "8", "", "", "", ""]);
    await user.keyboard("{Backspace}{Backspace}");
    expect(digits().map((d) => (d as HTMLInputElement).value).join("")).toBe("");
    expect(digits()[0]).toHaveFocus();
    expect(verify).not.toHaveBeenCalled();
  });

  it("explains a wrong code and stays on the screen", async () => {
    const user = userEvent.setup();
    verify.mockRejectedValueOnce(new ApiError(401, "INVALID_TWO_FACTOR_CODE", "That code is not valid."));
    const { onSuccess, digits } = renderForm();

    await user.keyboard("482916");

    expect(await screen.findByRole("alert")).toHaveTextContent("Incorrect verification code. Check your authenticator app and try again.");
    expect(onSuccess).not.toHaveBeenCalled();
    expect(digits().map((d) => (d as HTMLInputElement).value).join("")).toBe("");
  });

  it("sends the user back to login when the challenge has expired", async () => {
    const user = userEvent.setup();
    verify.mockRejectedValueOnce(new ApiError(401, "TWO_FACTOR_CHALLENGE_EXPIRED", "expired"));
    const { onCancel } = renderForm();

    await user.keyboard("482915");

    expect(await screen.findByRole("alert")).toHaveTextContent("Your verification session has expired. Please sign in again.");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /back to login/i }));
    expect(onCancel).toHaveBeenCalled();
  });

  it("accepts a recovery code instead", async () => {
    const user = userEvent.setup();
    const authUser = makeAuthUser();
    verify.mockResolvedValueOnce({ user: authUser, recoveryCodesRemaining: 9 });
    const { onSuccess } = renderForm();

    await user.click(screen.getByRole("button", { name: /use a recovery code/i }));
    await user.type(screen.getByLabelText(/recovery code/i), "abcde-fghjk");
    await user.click(screen.getByRole("button", { name: /verify code/i }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(authUser));
    expect(verify).toHaveBeenCalledWith({ challengeToken: "challenge-token", code: "abcde-fghjk" });
  });

  it("shows the API's wait time when there have been too many attempts", async () => {
    const user = userEvent.setup();
    verify.mockRejectedValueOnce(new ApiError(429, "RATE_LIMITED", "Too many code attempts. Please wait a few minutes and try again."));
    renderForm();

    await user.keyboard("000000");

    expect(await screen.findByRole("alert")).toHaveTextContent("Too many code attempts. Please wait a few minutes and try again.");
  });

  it("with a passkey on the account, offers it first and signs in with it", async () => {
    const user = userEvent.setup();
    const authUser = makeAuthUser();
    vi.mocked(authService.passkeyLoginOptions).mockResolvedValueOnce({ challenge: "c" } as never);
    vi.mocked(provePasskey).mockResolvedValueOnce({ id: "assertion" } as never);
    vi.mocked(authService.loginWithPasskey).mockResolvedValueOnce(authUser);
    const onSuccess = vi.fn();
    render(<TwoFactorLoginForm challenge={{ ...challenge, methods: ["totp", "passkey", "recovery"] }} onSuccess={onSuccess} onCancel={vi.fn()} />);

    // Both second factors are on offer.
    expect(screen.getByRole("button", { name: /use your authenticator app/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /use passkey/i }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(authUser));
    expect(authService.loginWithPasskey).toHaveBeenCalledWith({ challengeToken: "challenge-token", response: { id: "assertion" } });
  });

  it("explains a cancelled passkey prompt and lets the user pick another method", async () => {
    const user = userEvent.setup();
    vi.mocked(authService.passkeyLoginOptions).mockResolvedValueOnce({ challenge: "c" } as never);
    vi.mocked(provePasskey).mockRejectedValueOnce(new PasskeyCancelledError());
    render(<TwoFactorLoginForm challenge={{ ...challenge, methods: ["passkey", "recovery"] }} onSuccess={vi.fn()} onCancel={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /use passkey/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/cancelled or timed out/i);
    // No authenticator app on this account, so it is not offered.
    expect(screen.queryByRole("button", { name: /authenticator app/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /use a recovery code/i })).toBeInTheDocument();
  });
});
