import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { toUserPayload, UserForm } from "@/components/users/user-form";
import { ApiError } from "@/lib/api/client";
import { renderWithProviders } from "./utils";

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }), Toaster: () => null }));

const ROLES = [
  { value: "role-admin", label: "Admin" },
  { value: "role-employee", label: "Employee" },
];

async function fillValid(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/first name/i), "Grace");
  await user.type(screen.getByLabelText(/last name/i), "Hopper");
  await user.type(screen.getByLabelText(/^email/i), "Grace@TimeFlow.dev");
  await user.type(screen.getByLabelText(/^password/i), "Compiler1");

}

describe("UserForm", () => {
  it("shows inline validation errors for required fields", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderWithProviders(<UserForm mode="create" roleOptions={ROLES} onSubmit={onSubmit} />);

    await user.click(screen.getByRole("button", { name: /create user/i }));

    expect(await screen.findByText("First name is required")).toBeInTheDocument();
    expect(screen.getByText("Last name is required")).toBeInTheDocument();
    expect(screen.getByText("Email is required")).toBeInTheDocument();
    expect(screen.getByText(/min 8 characters/i)).toBeInTheDocument();
    expect(screen.getByText("Select a role")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("enforces the password policy", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderWithProviders(<UserForm mode="create" roleOptions={ROLES} defaultValues={{ roleId: "role-employee" }} onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/first name/i), "Grace");
    await user.type(screen.getByLabelText(/last name/i), "Hopper");
    await user.type(screen.getByLabelText(/^email/i), "grace@timeflow.dev");
    await user.type(screen.getByLabelText(/^password/i), "onlyletters");
    await user.click(screen.getByRole("button", { name: /create user/i }));

    expect(await screen.findByText(/at least one letter and one number/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits a normalized payload", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderWithProviders(<UserForm mode="create" roleOptions={ROLES} defaultValues={{ roleId: "role-employee" }} onSubmit={onSubmit} />);

    await fillValid(user);
    await user.click(screen.getByRole("button", { name: /create user/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({
      firstName: "Grace",
      lastName: "Hopper",
      email: "grace@timeflow.dev",
      phone: null,
      password: "Compiler1",
      roleId: "role-employee",
      status: "ACTIVE",
      avatarUrl: null,
    });
  });

  it("maps a duplicate email conflict onto the email field", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockRejectedValue(new ApiError(409, "USER_EMAIL_EXISTS", "Email already exists"));
    renderWithProviders(<UserForm mode="create" roleOptions={ROLES} defaultValues={{ roleId: "role-employee" }} onSubmit={onSubmit} />);

    await fillValid(user);
    await user.click(screen.getByRole("button", { name: /create user/i }));

    expect(await screen.findByText("Email already exists")).toBeInTheDocument();
    expect(screen.getByLabelText(/^email/i)).toHaveAttribute("aria-invalid", "true");
  });

  it("maps server VALIDATION_ERROR details to fields", async () => {
    const user = userEvent.setup();
    const onSubmit = vi
      .fn()
      .mockRejectedValue(new ApiError(400, "VALIDATION_ERROR", "Validation failed", [{ path: "phone", message: "Phone number is not dialable" }]));
    renderWithProviders(<UserForm mode="create" roleOptions={ROLES} defaultValues={{ roleId: "role-employee" }} onSubmit={onSubmit} />);

    await fillValid(user);
    await user.click(screen.getByRole("button", { name: /create user/i }));

    expect(await screen.findByText("Phone number is not dialable")).toBeInTheDocument();
  });

  it("omits an empty password when editing", () => {
    const payload = toUserPayload(
      { firstName: "A", lastName: "B", email: "A@B.CO", phone: "", password: "", roleId: "r", status: "INACTIVE", avatarUrl: null },
      "edit",
    );
    expect(payload).not.toHaveProperty("password");
    expect(payload).toMatchObject({ email: "a@b.co", phone: null, status: "INACTIVE" });
  });
});
