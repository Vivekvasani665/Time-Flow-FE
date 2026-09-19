import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SignupForm } from "@/components/auth/signup-form";
import { ApiError } from "@/lib/api/client";
import { authService } from "@/services/auth.service";
import { makeAuthUser } from "./utils";

vi.mock("@/services/auth.service", () => ({
  authService: { login: vi.fn(), register: vi.fn(), logout: vi.fn(), me: vi.fn() },
}));

const register = vi.mocked(authService.register);

async function fill(user: ReturnType<typeof userEvent.setup>, overrides: Partial<Record<"first" | "last" | "email" | "password", string>> = {}) {
  await user.type(screen.getByLabelText(/first name/i), overrides.first ?? "Sam");
  await user.type(screen.getByLabelText(/last name/i), overrides.last ?? "Rivera");
  await user.type(screen.getByLabelText(/email/i), overrides.email ?? "sam@company.com");
  await user.type(screen.getByLabelText(/^password/i), overrides.password ?? "Signup1234");
}

describe("SignupForm", () => {
  it("shows validation errors and does not call the API when fields are empty", async () => {
    const user = userEvent.setup();
    render(<SignupForm onSuccess={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByText("First name is required")).toBeInTheDocument();
    expect(screen.getByText("Last name is required")).toBeInTheDocument();
    expect(screen.getByText("Email is required")).toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();
  });

  it("rejects a weak password", async () => {
    const user = userEvent.setup();
    render(<SignupForm onSuccess={vi.fn()} />);

    await fill(user, { password: "short" });
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByText(/min 8 characters with at least one letter and one number/i)).toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();
  });

  it("creates the account and reports the new user", async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    const authUser = makeAuthUser();
    register.mockResolvedValueOnce(authUser);
    render(<SignupForm onSuccess={onSuccess} />);

    await fill(user);
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(authUser));
    expect(register).toHaveBeenCalledWith({ firstName: "Sam", lastName: "Rivera", email: "sam@company.com", password: "Signup1234" });
  });

  it("puts a taken email error on the email field", async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    register.mockRejectedValueOnce(new ApiError(409, "USER_EMAIL_EXISTS", "An account with this email already exists"));
    render(<SignupForm onSuccess={onSuccess} />);

    await fill(user);
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByText("An account with this email already exists")).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toHaveAttribute("aria-invalid", "true");
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("explains rate limiting", async () => {
    const user = userEvent.setup();
    register.mockRejectedValueOnce(new ApiError(429, "RATE_LIMITED", "Too many requests"));
    render(<SignupForm onSuccess={vi.fn()} />);

    await fill(user);
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/too many sign-up attempts/i);
  });
});
