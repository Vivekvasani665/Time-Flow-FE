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
    render(<LoginForm onSuccess={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /^sign in$/i }));

    expect(await screen.findByText("Email is required")).toBeInTheDocument();
    expect(screen.getByText("Password is required")).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toHaveAttribute("aria-invalid", "true");
    expect(login).not.toHaveBeenCalled();
  });

  it("rejects a malformed email", async () => {
    const user = userEvent.setup();
    render(<LoginForm onSuccess={vi.fn()} />);

    await user.type(screen.getByLabelText(/email/i), "not-an-email");
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
    render(<LoginForm onSuccess={onSuccess} />);

    await user.type(screen.getByLabelText(/email/i), "admin@timeflow.dev");
    await user.type(screen.getByLabelText(/^password/i), "Password123!");
    await user.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(authUser));
    expect(login).toHaveBeenCalledWith({ email: "admin@timeflow.dev", password: "Password123!" });
  });

  it("displays the server error for invalid credentials", async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    login.mockRejectedValueOnce(new ApiError(401, "INVALID_CREDENTIALS", "Invalid email or password"));
    render(<LoginForm onSuccess={onSuccess} />);

    await user.type(screen.getByLabelText(/email/i), "admin@timeflow.dev");
    await user.type(screen.getByLabelText(/^password/i), "wrong-pass1");
    await user.click(screen.getByRole("button", { name: /^sign in$/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid email or password.");
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("explains rate limiting", async () => {
    const user = userEvent.setup();
    login.mockRejectedValueOnce(new ApiError(429, "RATE_LIMITED", "Too many requests"));
    render(<LoginForm onSuccess={vi.fn()} />);

    await user.type(screen.getByLabelText(/email/i), "admin@timeflow.dev");
    await user.type(screen.getByLabelText(/^password/i), "Password123!");
    await user.click(screen.getByRole("button", { name: /^sign in$/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/too many login attempts/i);
  });

  it("fills credentials from a demo account chip", async () => {
    const user = userEvent.setup();
    render(<LoginForm onSuccess={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /employee@timeflow\.dev/i }));

    expect(screen.getByLabelText(/email/i)).toHaveValue("employee@timeflow.dev");
    expect(screen.getByLabelText(/^password/i)).toHaveValue(DEMO_PASSWORD);
  });
});
