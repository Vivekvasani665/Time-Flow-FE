import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TwoFactorSetupLoginForm } from "@/components/auth/two-factor-setup-login-form";
import { ApiError } from "@/lib/api/client";
import { authService, type TwoFactorSetupChallenge } from "@/services/auth.service";
import { makeAuthUser } from "./utils";

vi.mock("@/services/auth.service", () => ({
  authService: { completeTwoFactorSetup: vi.fn(), logout: vi.fn(), me: vi.fn() },
}));

const complete = vi.mocked(authService.completeTwoFactorSetup);

const challenge: TwoFactorSetupChallenge = {
  twoFactorSetupRequired: true,
  challengeToken: "setup-token",
  challengeExpiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
  setup: { secret: "JBSWY3DPEHPK3PXP", otpauthUrl: "otpauth://totp/x", qrCodeDataUrl: "data:image/png;base64,QR" },
};

describe("TwoFactorSetupLoginForm", () => {
  it("shows the pending QR, then recovery codes, and only then continues to the dashboard", async () => {
    const user = userEvent.setup();
    const authUser = makeAuthUser(undefined, { twoFactorEnabled: true });
    complete.mockResolvedValueOnce({ user: authUser, recoveryCodes: ["abcde-fghjk"] });
    const onSuccess = vi.fn();
    render(<TwoFactorSetupLoginForm challenge={challenge} onSuccess={onSuccess} onCancel={vi.fn()} />);

    expect(screen.getByAltText(/qr code/i)).toHaveAttribute("src", "data:image/png;base64,QR");
    await user.click(screen.getByRole("textbox", { name: /digit 1 of 6/i }));
    await user.keyboard("482915");

    await waitFor(() => expect(complete).toHaveBeenCalledWith({ challengeToken: "setup-token", code: "482915" }));
    expect(await screen.findByText("Two-factor authentication has been enabled successfully.")).toBeInTheDocument();
    expect(screen.getByText("abcde-fghjk")).toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /continue to dashboard/i }));
    expect(onSuccess).toHaveBeenCalledWith(authUser);
  });

  it("keeps the user on the QR screen after a wrong code", async () => {
    const user = userEvent.setup();
    complete.mockRejectedValueOnce(new ApiError(400, "INVALID_TWO_FACTOR_CODE", "That code is not valid."));
    render(<TwoFactorSetupLoginForm challenge={challenge} onSuccess={vi.fn()} onCancel={vi.fn()} />);

    await user.click(screen.getByRole("textbox", { name: /digit 1 of 6/i }));
    await user.keyboard("000000");

    expect(await screen.findByRole("alert")).toHaveTextContent("Incorrect verification code.");
    expect(screen.getByAltText(/qr code/i)).toBeInTheDocument();
  });
});
