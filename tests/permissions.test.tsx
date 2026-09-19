import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Can } from "@/components/auth/can";
import { RequirePermission } from "@/components/auth/require-permission";
import { Sidebar } from "@/components/layout/sidebar";
import { UsersList } from "@/components/users/users-list";
import { rolesService } from "@/services/roles.service";
import { usersService } from "@/services/users.service";
import { makeAuthUser, makeUser, openMenu, renderWithProviders } from "./utils";

vi.mock("@/services/users.service", () => ({
  usersService: { list: vi.fn(), remove: vi.fn(), setStatus: vi.fn(), options: vi.fn(), get: vi.fn() },
}));
vi.mock("@/services/roles.service", () => ({
  rolesService: { list: vi.fn() },
}));

const USERS_PAGE = {
  items: [makeUser()],
  meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
};

beforeEach(() => {
  vi.mocked(usersService.list).mockResolvedValue(USERS_PAGE);
  vi.mocked(rolesService.list).mockResolvedValue({ items: [], meta: { page: 1, limit: 100, total: 0, totalPages: 1 } });
});

async function openFirstRowMenu() {
  const [trigger] = await screen.findAllByRole("button", { name: /actions for john doe/i });
  return openMenu(trigger!);
}

describe("<Can>", () => {
  it("renders children only when the permission is held", () => {
    renderWithProviders(
      <>
        <Can permission="users.delete">
          <span>delete-visible</span>
        </Can>
        <Can permission="roles.delete" fallback={<span>no-roles-delete</span>}>
          <span>roles-delete-visible</span>
        </Can>
        <Can permission={["tasks.delete", "users.view"]}>
          <span>any-of-visible</span>
        </Can>
        <Can permission={["tasks.delete", "users.view"]} mode="all">
          <span>all-of-visible</span>
        </Can>
      </>,
      { user: makeAuthUser(["users.delete", "users.view"]) },
    );

    expect(screen.getByText("delete-visible")).toBeInTheDocument();
    expect(screen.getByText("no-roles-delete")).toBeInTheDocument();
    expect(screen.queryByText("roles-delete-visible")).not.toBeInTheDocument();
    expect(screen.getByText("any-of-visible")).toBeInTheDocument();
    expect(screen.queryByText("all-of-visible")).not.toBeInTheDocument();
  });

  it("shows ACCESS DENIED for guarded routes without permission", () => {
    renderWithProviders(
      <RequirePermission permission="users.view">
        <p>secret roster</p>
      </RequirePermission>,
      { user: makeAuthUser(["tasks.view"]) },
    );
    expect(screen.getByRole("heading", { name: /access denied/i })).toBeInTheDocument();
    expect(screen.queryByText("secret roster")).not.toBeInTheDocument();
  });
});

describe("Sidebar", () => {
  it("only lists modules the user has clearance for", () => {
    renderWithProviders(<Sidebar collapsed={false} onToggleCollapsed={vi.fn()} mobileOpen={false} onCloseMobile={vi.fn()} />, {
      user: makeAuthUser(["projects.view", "tasks.view", "tasks.update"]),
    });
    const nav = screen.getByRole("navigation");
    expect(within(nav).getByRole("link", { name: /dashboard/i })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: /projects/i })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: /tasks/i })).toBeInTheDocument();
    expect(within(nav).queryByRole("link", { name: /users/i })).not.toBeInTheDocument();
    expect(within(nav).queryByRole("link", { name: /roles/i })).not.toBeInTheDocument();
    expect(within(nav).queryByRole("link", { name: /system/i })).not.toBeInTheDocument();
  });
});

describe("UsersList permission-based actions", () => {
  it("hides Delete, Edit and New user without the matching permissions", async () => {
    renderWithProviders(<UsersList />, { user: makeAuthUser(["users.view"]) });

    await screen.findAllByRole("button", { name: /actions for john doe/i });
    expect(screen.queryByRole("link", { name: /new user/i })).not.toBeInTheDocument();

    const menu = await openFirstRowMenu();
    expect(within(menu).getByRole("menuitem", { name: /view/i })).toBeInTheDocument();
    expect(within(menu).queryByRole("menuitem", { name: /delete/i })).not.toBeInTheDocument();
    expect(within(menu).queryByRole("menuitem", { name: /edit/i })).not.toBeInTheDocument();
  });

  it("shows Delete for users holding users.delete", async () => {
    renderWithProviders(<UsersList />, { user: makeAuthUser(["users.view", "users.create", "users.update", "users.delete"]) });

    await screen.findAllByRole("button", { name: /actions for john doe/i });
    expect(screen.getByRole("link", { name: /new user/i })).toBeInTheDocument();

    const menu = await openFirstRowMenu();
    expect(within(menu).getByRole("menuitem", { name: /delete/i })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: /deactivate/i })).toBeInTheDocument();
  });

  it("never offers delete on your own account", async () => {
    const me = makeAuthUser(["users.view", "users.delete"], { id: makeUser().id });
    renderWithProviders(<UsersList />, { user: me });

    const menu = await openFirstRowMenu();
    expect(within(menu).queryByRole("menuitem", { name: /delete/i })).not.toBeInTheDocument();
  });
});
