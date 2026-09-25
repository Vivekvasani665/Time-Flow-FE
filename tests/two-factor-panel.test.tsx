import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TwoFactorPanel } from "@/components/settings/two-factor-panel";
import { ApiError } from "@/lib/api/client";
import { createPasskey, provePasskey } from "@/lib/passkeys";
import { twoFactorService } from "@/services/two-factor.service";
import type { TwoFactorStatus } from "@/types/api";
import { renderWithProviders } from "./utils";

vi.mock("@/services/two-factor.service", () => ({
  twoFactorService: {
    status: vi.fn(),
    setup: vi.fn(),
    cancelSetup: vi.fn(),
    enable: vi.fn(),
    removeTotp: vi.fn(),
    stepUpOptions: vi.fn(),
    disable: vi.fn(),
    regenerateRecoveryCodes: vi.fn(),
    passkeyOptions: vi.fn(),
    addPasskey: vi.fn(),
    removePasskey: vi.fn(),
  },
}));

vi.mock("@/lib/passkeys", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/passkeys")>()),
  passkeysSupported: () => true,
  createPasskey: vi.fn(),
  provePasskey: vi.fn(),
}));

const service = vi.mocked(twoFactorService);
const RECOVERY = ["abcde-fghjk", "mnpqr-stuvw"];
const SETUP = { secret: "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP", otpauthUrl: "otpauth://totp/x", qrCodeDataUrl: "data:image/png;base64,AAAA" };

const status = (overrides: Partial<TwoFactorStatus> = {}): TwoFactorStatus => ({
  enabled: false,
  enabledAt: null,
  recoveryCodesRemaining: 0,
  totp: { enabled: false, pending: false },
  passkeys: [],
  ...overrides,
});

const PASSKEY = { id: "p1", name: "Chrome on macOS", backedUp: true, createdAt: "2026-09-01T10:00:00.000Z", lastUsedAt: null };

async function typeCode(dialog: HTMLElement, user: ReturnType<typeof userEvent.setup>, code: string) {
  await user.click(within(dialog).getByRole("textbox", { name: /digit 1 of 6/i }));
  await user.keyboard(code);
}

describe("TwoFactorPanel", () => {
  it("enable 2FA happens inside the panel: password, QR + setup key, code, recovery codes — no pop-up", async () => {
    const user = userEvent.setup();
    service.status.mockResolvedValue(status());
    service.setup.mockResolvedValueOnce(SETUP);
    service.enable.mockResolvedValueOnce({ recoveryCodes: RECOVERY });
    renderWithProviders(<TwoFactorPanel />);

    expect(await screen.findByText("Off")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /enable 2fa/i }));

    await user.type(screen.getByLabelText(/password/i), "Password123!");
    await user.click(screen.getByRole("button", { name: /^continue$/i }));
    await waitFor(() => expect(service.setup).toHaveBeenCalledWith("Password123!", expect.anything()));

    expect(await screen.findByAltText(/qr code/i)).toHaveAttribute("src", SETUP.qrCodeDataUrl);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /show setup key/i }));
    expect(screen.getByText("JBSW Y3DP EHPK 3PXP JBSW Y3DP EHPK 3PXP")).toBeInTheDocument();

    await user.click(screen.getByRole("textbox", { name: /digit 1 of 6/i }));
    await user.keyboard("123456");
    await waitFor(() => expect(service.enable).toHaveBeenCalledWith("123456", expect.anything()));
    const codes = await screen.findByRole("list", { name: /recovery codes/i });
    expect(within(codes).getAllByRole("listitem").map((li) => li.textContent)).toEqual(RECOVERY);
    expect(screen.getByText("These codes will not be shown again.")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("reports a wrong password without showing a QR code", async () => {
    const user = userEvent.setup();
    service.status.mockResolvedValue(status());
    service.setup.mockRejectedValueOnce(new ApiError(400, "INVALID_PASSWORD", "Incorrect password"));
    renderWithProviders(<TwoFactorPanel />);

    await user.click(await screen.findByRole("button", { name: /enable 2fa/i }));
    await user.type(screen.getByLabelText(/password/i), "nope");
    await user.click(screen.getByRole("button", { name: /^continue$/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Incorrect password.");
    expect(screen.queryByAltText(/qr code/i)).not.toBeInTheDocument();
  });

  it("shows a pending setup, which can be continued or cancelled", async () => {
    const user = userEvent.setup();
    service.status.mockResolvedValue(status({ totp: { enabled: false, pending: true } }));
    service.cancelSetup.mockResolvedValueOnce(undefined);
    renderWithProviders(<TwoFactorPanel />);

    expect(await screen.findByText("Setup pending")).toBeInTheDocument();
    expect(screen.getByText(/on the login page at your next sign-in/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /continue setup/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /cancel setup/i }));
    await waitFor(() => expect(service.cancelSetup).toHaveBeenCalled());
  });

  it("adds a passkey; the first one turns 2FA on and shows recovery codes", async () => {
    const user = userEvent.setup();
    service.status.mockResolvedValue(status());
    service.passkeyOptions.mockResolvedValueOnce({ challenge: "c" } as never);
    vi.mocked(createPasskey).mockResolvedValueOnce({ id: "cred" } as never);
    service.addPasskey.mockResolvedValueOnce({ passkey: PASSKEY, recoveryCodes: RECOVERY });
    renderWithProviders(<TwoFactorPanel />);

    await user.click(await screen.findByRole("button", { name: /add a passkey/i }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText(/password/i), "Password123!");
    await user.click(within(dialog).getByRole("button", { name: /continue/i }));

    await waitFor(() => expect(service.addPasskey).toHaveBeenCalledWith({ response: { id: "cred" } }, expect.anything()));
    expect(service.passkeyOptions).toHaveBeenCalledWith("Password123!");
    expect(await screen.findByRole("list", { name: /recovery codes/i })).toBeInTheDocument();
  });

  it("disables 2FA with the password plus a passkey", async () => {
    const user = userEvent.setup();
    service.status.mockResolvedValue(status({ enabled: true, enabledAt: "2026-09-01T10:00:00.000Z", recoveryCodesRemaining: 2, passkeys: [PASSKEY] }));
    service.stepUpOptions.mockResolvedValueOnce({ challenge: "c" } as never);
    vi.mocked(provePasskey).mockResolvedValueOnce({ id: "assertion" } as never);
    service.disable.mockResolvedValueOnce(undefined);
    renderWithProviders(<TwoFactorPanel />);

    expect(await screen.findByText("Chrome on macOS")).toBeInTheDocument();
    expect(screen.getByText(/running low/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /disable 2fa/i }));

    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText(/password/i), "Password123!");
    await user.click(within(dialog).getByRole("button", { name: /disable 2fa/i }));

    await waitFor(() => expect(service.disable).toHaveBeenCalledWith({ password: "Password123!", passkey: { id: "assertion" } }, expect.anything()));
  });

  it("disabling with an authenticator code reports a wrong password", async () => {
    const user = userEvent.setup();
    service.status.mockResolvedValue(status({ enabled: true, enabledAt: "2026-09-01T10:00:00.000Z", recoveryCodesRemaining: 10, totp: { enabled: true, pending: false } }));
    service.disable.mockRejectedValueOnce(new ApiError(400, "INVALID_PASSWORD", "Incorrect password"));
    renderWithProviders(<TwoFactorPanel />);

    await user.click(await screen.findByRole("button", { name: /disable 2fa/i }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText(/password/i), "wrong-password");
    await typeCode(dialog, user, "123456");
    await user.click(within(dialog).getByRole("button", { name: /disable 2fa/i }));

    await waitFor(() => expect(service.disable).toHaveBeenCalledWith({ password: "wrong-password", code: "123456" }, expect.anything()));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Incorrect password.");
  });
});
