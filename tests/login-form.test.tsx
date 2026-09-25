import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DEMO_PASSWORD, LoginForm } from "@/components/auth/login-form";
import { ApiError } from "@/lib/api/client";
import { authService } from "@/services/auth.service";
import { makeAuthUser } from "./utils";

vi.mock("@/services/auth.service", () => ({
  authService: { login: vi.fn(), logout: vi.fn(), me: vi.fn() },
}));

const login = vi.mocked(authService.login);

describe("LoginForm", () => {
  it("shows validation errors and does not call the API when fields are empty", async () => {
    const user = userEvent.setup();
    render(<LoginForm onSuccess={vi.fn()} onOtpRequired={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /^sign in$/i }));

    expect(await screen.findByText("Email or mobile number is required")).toBeInTheDocument();
    expect(screen.getByText("Password is required")).toBeInTheDocument();
    expect(screen.getByLabelText(/email or mobile/i)).toHaveAttribute("aria-invalid", "true");
    expect(login).not.toHaveBeenCalled();
  });

  it("rejects a malformed email", async () => {
    const user = userEvent.setup();
    render(<LoginForm onSuccess={vi.fn()} onOtpRequired={vi.fn()} />);

    await user.type(screen.getByLabelText(/email or mobile/i), "not@an-email");
    await user.type(screen.getByLabelText(/^password/i), "secret");
    await user.click(screen.getByRole("button", { name: /^sign in$/i }));

    expect(await screen.findByText("Enter a valid email address")).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  it("submits credentials and reports the authenticated user", async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    const authUser = makeAuthUser();
    login.mockResolvedValueOnce({ signedIn: true, user: authUser });
    render(<LoginForm onSuccess={onSuccess} onOtpRequired={vi.fn()} />);

    await user.type(screen.getByLabelText(/email or mobile/i), "admin@timeflow.dev");
    await user.type(screen.getByLabelText(/^password/i), "Password123!");
    await user.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(authUser));
    expect(login).toHaveBeenCalledWith({ email: "admin@timeflow.dev", password: "Password123!" });
    expect(localStorage.getItem("tf.login.identifier")).toBeNull();
  });

  it("displays the server error for invalid credentials", async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    login.mockRejectedValueOnce(new ApiError(401, "INVALID_CREDENTIALS", "Invalid email or password"));
    render(<LoginForm onSuccess={onSuccess} onOtpRequired={vi.fn()} />);

    await user.type(screen.getByLabelText(/email or mobile/i), "admin@timeflow.dev");
    await user.type(screen.getByLabelText(/^password/i), "wrong-pass1");
    await user.click(screen.getByRole("button", { name: /^sign in$/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid email / mobile number or password.");
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("explains rate limiting", async () => {
    const user = userEvent.setup();
    login.mockRejectedValueOnce(new ApiError(429, "RATE_LIMITED", "Too many requests"));
    render(<LoginForm onSuccess={vi.fn()} onOtpRequired={vi.fn()} />);

    await user.type(screen.getByLabelText(/email or mobile/i), "admin@timeflow.dev");
    await user.type(screen.getByLabelText(/^password/i), "Password123!");
    await user.click(screen.getByRole("button", { name: /^sign in$/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/too many login attempts/i);
  });

  it("signs in with a mobile number, dropping spaces and dashes", async () => {
    const user = userEvent.setup();
    login.mockResolvedValueOnce({ signedIn: true, user: makeAuthUser() });
    render(<LoginForm onSuccess={vi.fn()} onOtpRequired={vi.fn()} />);

    await user.type(screen.getByLabelText(/email or mobile/i), "+91 98765-43210");
    await user.type(screen.getByLabelText(/^password/i), "Password123!");
    await user.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() => expect(login).toHaveBeenCalledWith({ phone: "+919876543210", password: "Password123!" }));
  });

  it("asks for the country code on a bare mobile number", async () => {
    const user = userEvent.setup();
    render(<LoginForm onSuccess={vi.fn()} onOtpRequired={vi.fn()} />);

    await user.type(screen.getByLabelText(/email or mobile/i), "9876543210");
    await user.type(screen.getByLabelText(/^password/i), "Password123!");
    await user.click(screen.getByRole("button", { name: /^sign in$/i }));

    expect(await screen.findByText(/with its country code/i)).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  it("remembers the email or mobile number, not the password, when asked", async () => {
    const user = userEvent.setup();
    login.mockResolvedValueOnce({ signedIn: true, user: makeAuthUser() });
    render(<LoginForm onSuccess={vi.fn()} onOtpRequired={vi.fn()} />);

    await user.type(screen.getByLabelText(/email or mobile/i), "admin@timeflow.dev");
    await user.type(screen.getByLabelText(/^password/i), "Password123!");
    await user.click(screen.getByRole("checkbox", { name: /remember me/i }));
    await user.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() => expect(login).toHaveBeenCalled());
    expect(localStorage.getItem("tf.login.identifier")).toBe("admin@timeflow.dev");
    localStorage.clear();
  });

  it("fills credentials from a demo account chip", async () => {
    const user = userEvent.setup();
    render(<LoginForm onSuccess={vi.fn()} onOtpRequired={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /employee@timeflow\.dev/i }));

    expect(screen.getByLabelText(/email or mobile/i)).toHaveValue("employee@timeflow.dev");
    expect(screen.getByLabelText(/^password/i)).toHaveValue(DEMO_PASSWORD);
  });

  it("hands an authenticator-app challenge to the next step instead of signing in", async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    const onTwoFactorRequired = vi.fn();
    const challenge = { twoFactorRequired: true as const, challengeToken: "t", challengeExpiresAt: new Date().toISOString() };
    login.mockResolvedValueOnce(challenge);
    render(<LoginForm onSuccess={onSuccess} onOtpRequired={vi.fn()} onTwoFactorRequired={onTwoFactorRequired} />);

    await user.type(screen.getByLabelText(/email or mobile/i), "admin@timeflow.dev");
    await user.type(screen.getByLabelText(/^password/i), "Password123!");
    await user.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() => expect(onTwoFactorRequired).toHaveBeenCalledWith(challenge));
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("hands a pending 2FA setup to the QR step instead of signing in", async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    const onTwoFactorSetupRequired = vi.fn();
    const challenge = {
      twoFactorSetupRequired: true as const,
      challengeToken: "t",
      challengeExpiresAt: new Date().toISOString(),
      setup: { secret: "S", otpauthUrl: "otpauth://x", qrCodeDataUrl: "data:image/png;base64,QR" },
    };
    login.mockResolvedValueOnce(challenge);
    render(<LoginForm onSuccess={onSuccess} onOtpRequired={vi.fn()} onTwoFactorSetupRequired={onTwoFactorSetupRequired} />);

    await user.type(screen.getByLabelText(/email or mobile/i), "admin@timeflow.dev");
    await user.type(screen.getByLabelText(/^password/i), "Password123!");
    await user.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() => expect(onTwoFactorSetupRequired).toHaveBeenCalledWith(challenge));
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
