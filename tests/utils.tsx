import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, waitFor, type RenderOptions } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { AuthProvider } from "@/components/auth/auth-provider";
import { DEFAULT_PREFERENCES } from "@/lib/preferences";
import { queryKeys } from "@/lib/query-keys";
import type { AuthUser, User } from "@/types/api";

export const ALL_PERMISSIONS = [
  "users.view",
  "users.create",
  "users.update",
  "users.delete",
  "roles.view",
  "roles.create",
  "roles.update",
  "roles.delete",
  "projects.view",
  "projects.create",
  "projects.update",
  "projects.delete",
  "projects.view_all",
  "tasks.view",
  "tasks.create",
  "tasks.update",
  "tasks.delete",
  "tasks.view_all",
  "activity_logs.view",
  "activity_logs.export",
  "emails.view",
  "emails.send",
  "emails.view_all",
  "queues.view",
  "queues.manage",
];

export function makeAuthUser(permissions: string[] = ALL_PERMISSIONS, overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    firstName: "Ada",
    lastName: "Admin",
    email: "admin@timeflow.dev",
    phone: null,
    avatarUrl: null,
    status: "ACTIVE",
    role: { id: "role-admin", name: "Admin" },
    permissions,
    preferences: DEFAULT_PREFERENCES,
    lastLoginAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

export function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    firstName: "John",
    lastName: "Doe",
    email: "john@timeflow.dev",
    avatarUrl: null,
    phone: "+1 555 0100",
    status: "ACTIVE",
    role: { id: "role-employee", name: "Employee" },
    lastLoginAt: null,
    createdAt: "2026-02-01T00:00:00.000Z",
    updatedAt: "2026-02-01T00:00:00.000Z",
    ...overrides,
  };
}

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } },
  });
}

type Options = Omit<RenderOptions, "wrapper"> & { user?: AuthUser | null; queryClient?: QueryClient };

export function renderWithProviders(ui: ReactElement, { user = makeAuthUser(), queryClient = createTestQueryClient(), ...options }: Options = {}) {
  if (user) queryClient.setQueryData(queryKeys.me, user);
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <AuthProvider>{children}</AuthProvider>
      </QueryClientProvider>
    );
  }
  return { queryClient, ...render(ui, { wrapper: Wrapper, ...options }) };
}

/** Opens a Radix dropdown via keyboard (like a user pressing Enter) and returns the menu element. */
export async function openMenu(trigger: HTMLElement): Promise<HTMLElement> {
  fireEvent.keyDown(trigger, { key: "Enter" });
  return waitFor(() => {
    const menu = document.querySelector<HTMLElement>('[role="menu"]');
    if (!menu) throw new Error("menu not open");
    return menu;
  });
}
