import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectForm } from "@/components/projects/project-form";
import { UsersList } from "@/components/users/users-list";
import { rolesService } from "@/services/roles.service";
import { usersService } from "@/services/users.service";
import { makeAuthUser, makeUser, openMenu, renderWithProviders } from "./utils";

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }), Toaster: () => null }));
vi.mock("@/services/users.service", () => ({
  usersService: { list: vi.fn(), remove: vi.fn(), setStatus: vi.fn(), options: vi.fn() },
}));
vi.mock("@/services/roles.service", () => ({ rolesService: { list: vi.fn() } }));

const john = makeUser();
const MANAGER = { id: "22222222-2222-4222-8222-222222222222", firstName: "Mia", lastName: "Manager", email: "manager@timeflow.dev", avatarUrl: null };

beforeEach(() => {
  vi.mocked(rolesService.list).mockResolvedValue({ items: [], meta: { page: 1, limit: 100, total: 0, totalPages: 1 } });
  vi.mocked(usersService.options).mockResolvedValue([MANAGER]);
});

describe("Delete user flow", () => {
  it("confirms, calls the API, refreshes the list and shows a toast", async () => {
    const user = userEvent.setup();
    vi.mocked(usersService.list)
      .mockResolvedValueOnce({ items: [john], meta: { page: 1, limit: 10, total: 1, totalPages: 1 } })
      .mockResolvedValue({ items: [], meta: { page: 1, limit: 10, total: 0, totalPages: 0 } });
    vi.mocked(usersService.remove).mockResolvedValue(undefined);

    renderWithProviders(<UsersList />, { user: makeAuthUser() });

    const [trigger] = await screen.findAllByRole("button", { name: /actions for john doe/i });
    const menu = await openMenu(trigger!);
    fireEvent.click(within(menu).getByRole("menuitem", { name: /delete/i }));

    const dialog = await screen.findByRole("dialog", { name: /delete user/i });
    expect(within(dialog).getByText("John Doe")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: /^delete$/i }));

    await waitFor(() => expect(usersService.remove).toHaveBeenCalledWith(john.id));
    expect(toast.success).toHaveBeenCalledWith("User deleted", expect.anything());
    expect(await screen.findByText(/no users found/i)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("cancelling the dialog does not delete", async () => {
    const user = userEvent.setup();
    vi.mocked(usersService.list).mockResolvedValue({ items: [john], meta: { page: 1, limit: 10, total: 1, totalPages: 1 } });
    renderWithProviders(<UsersList />, { user: makeAuthUser() });

    const [trigger] = await screen.findAllByRole("button", { name: /actions for john doe/i });
    const menu = await openMenu(trigger!);
    fireEvent.click(within(menu).getByRole("menuitem", { name: /delete/i }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: /cancel/i }));

    expect(usersService.remove).not.toHaveBeenCalled();
  });
});

describe("Create project form", () => {
  it("validates the date range", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderWithProviders(
      <ProjectForm mode="create" defaultValues={{ managerId: MANAGER.id, startDate: "2026-05-10" }} knownUsers={[MANAGER]} onSubmit={onSubmit} />,
    );

    await user.type(screen.getByLabelText(/project name/i), "Website Redesign");
    await user.type(screen.getByLabelText(/end date/i), "2026-05-01");
    await user.click(screen.getByRole("button", { name: /create project/i }));

    expect(await screen.findByText(/end date must be on or after/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits the expected payload", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderWithProviders(
      <ProjectForm mode="create" defaultValues={{ managerId: MANAGER.id, startDate: "2026-05-10" }} knownUsers={[MANAGER]} onSubmit={onSubmit} />,
    );

    await user.type(screen.getByLabelText(/project name/i), "  Website Redesign ");
    await user.type(screen.getByLabelText(/description/i), "New marketing site");
    await user.type(screen.getByLabelText(/end date/i), "2026-06-30");
    await user.click(screen.getByRole("button", { name: /create project/i }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        name: "Website Redesign",
        description: "New marketing site",
        status: "PLANNING",
        priority: "MEDIUM",
        startDate: "2026-05-10",
        endDate: "2026-06-30",
        managerId: MANAGER.id,
        memberIds: [],
      }),
    );
  });
});
