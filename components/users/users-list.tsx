"use client";

import { Eye, KeyRound, MailPlus, Pencil, Power, Trash2, UserPlus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth, usePermissions } from "@/components/auth/auth-provider";
import { Can } from "@/components/auth/can";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { RowActions } from "@/components/data-table/row-actions";
import { TableToolbar } from "@/components/data-table/table-toolbar";
import { Avatar } from "@/components/ui/avatar";
import { PasswordResetStatusBadge, RankBadge, UserStatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { PasswordResetDetailsDialog, SendPasswordResetDialog } from "@/components/users/password-reset-dialogs";
import { useLatestPasswordResets } from "@/hooks/use-password-resets";
import { useRoles } from "@/hooks/use-roles";
import { useTableParams } from "@/hooks/use-table-params";
import { useDeleteUser, useSetUserStatus, useUsers } from "@/hooks/use-users";
import { isSuperAdmin } from "@/lib/labels";
import { formatDate, formatDateTime, fullName } from "@/lib/utils";
import type { User, UserListParams, UserStatus } from "@/types/api";
import { notifyError } from "@/lib/notify";

const FILTERS = ["status", "roleId"] as const;

type PendingAction = { type: "delete" | "status"; user: User } | null;

type ResetDialog = { type: "send"; user: Pick<User, "id" | "firstName" | "lastName" | "email">; resend: boolean } | { type: "details"; user: User } | null;

export function UsersList() {
  const { user: me } = useAuth();
  const { can } = usePermissions();
  const { params, apiParams, update, toggleSort } = useTableParams(FILTERS);
  const query = useUsers(apiParams as UserListParams);
  const roles = useRoles({ limit: 100, sortBy: "name", sortOrder: "asc" }, can("roles.view"));
  const deleteUser = useDeleteUser();
  const setStatus = useSetUserStatus();
  const [pending, setPending] = useState<PendingAction>(null);
  // Password resets are a Super Admin power (enforced by the API); others never see the column.
  const superAdmin = isSuperAdmin(me);
  const pageUserIds = (query.data?.items ?? []).map((u) => u.id);
  const resets = useLatestPasswordResets(pageUserIds, superAdmin);
  const [resetDialog, setResetDialog] = useState<ResetDialog>(null);

  const columns: Column<User>[] = [
    {
      key: "user",
      header: "User",
      sortKey: "firstName",
      primary: true,
      cell: (u) => (
        <Link href={`/users/${u.id}`} className="flex min-w-0 items-center gap-3 hover:[&_.name]:text-cyan" onClick={(e) => e.stopPropagation()}>
          <Avatar user={u} size="md" />
          <span className="min-w-0">
            <span className="name block truncate font-medium text-ink transition-colors">{fullName(u)}</span>
            <span className="block truncate text-sm text-ink-mute">{u.email}</span>
          </span>
        </Link>
      ),
    },
    { key: "role", header: "Role", cell: (u) => <RankBadge roleName={u.role.name} /> },
    { key: "status", header: "Status", sortKey: "status", cell: (u) => <UserStatusBadge status={u.status} /> },
    ...(superAdmin
      ? [
          {
            key: "passwordReset",
            header: "Password reset",
            cell: (u: User) => {
              const reset = resets.data?.get(u.id);
              return reset ? (
                <button
                  type="button"
                  className="rounded-full focus-visible:outline-2 focus-visible:outline-cyan"
                  title="View password reset details"
                  onClick={(e) => {
                    e.stopPropagation();
                    setResetDialog({ type: "details", user: u });
                  }}
                >
                  <PasswordResetStatusBadge status={reset.status} />
                </button>
              ) : (
                <span className="text-sm text-ink-mute">—</span>
              );
            },
          } satisfies Column<User>,
        ]
      : []),
    { key: "phone", header: "Phone", hideOnMobile: true, cell: (u) => <span className="tabular text-sm text-ink-dim">{u.phone ?? "—"}</span> },
    {
      key: "lastLoginAt",
      header: "Last login",
      sortKey: "lastLoginAt",
      cell: (u) => <span className="tabular text-xs text-ink-dim">{formatDateTime(u.lastLoginAt)}</span>,
    },
    { key: "createdAt", header: "Joined", sortKey: "createdAt", hideOnMobile: true, cell: (u) => <span className="tabular text-xs text-ink-dim">{formatDate(u.createdAt)}</span> },
  ];

  const confirm = async () => {
    if (!pending) return;
    const { user } = pending;
    try {
      if (pending.type === "delete") {
        await deleteUser.mutateAsync(user.id);
        toast.success("User deleted", { description: `${fullName(user)} was removed.` });
      } else {
        const status: UserStatus = user.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
        await setStatus.mutateAsync({ id: user.id, status });
        toast.success(status === "ACTIVE" ? "User activated" : "User deactivated", { description: fullName(user) });
      }
      setPending(null);
    } catch (error) {
      notifyError(error, { title: "Action failed" });
    }
  };

  const hasFilters = Boolean(params.search || params.filters.status || params.filters.roleId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description="Manage team members, their roles and account status."
        actions={
          <>
            {superAdmin && (
              <ButtonLink href="/users/invite" variant="secondary" icon={<MailPlus className="size-4" />}>
                Invite user
              </ButtonLink>
            )}
            <Can permission="users.create">
              <ButtonLink href="/users/new" icon={<UserPlus className="size-4" />}>
                New user
              </ButtonLink>
            </Can>
          </>
        }
      />

      <DataTable
        caption="Users"
        columns={columns}
        data={query.data?.items}
        meta={query.data?.meta}
        getRowId={(u) => u.id}
        isLoading={query.isLoading}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        sortBy={params.sortBy}
        sortOrder={params.sortOrder}
        onSort={toggleSort}
        onPageChange={(page) => update({ page }, false)}
        onLimitChange={(limit) => update({ limit })}
        rowHref={(u) => `/users/${u.id}`}
        toolbar={
          <TableToolbar
            search={params.search}
            onSearch={(search) => update({ search })}
            placeholder="Search name, email, phone…"
            filters={
              <>
                <Select
                  aria-label="Filter by status"
                  className="lg:w-40"
                  value={params.filters.status}
                  onValueChange={(status) => update({ status })}
                  allLabel="All statuses"
                  options={[
                    { value: "ACTIVE", label: "Active" },
                    { value: "INACTIVE", label: "Inactive" },
                  ]}
                />
                {can("roles.view") && (
                  <Select
                    aria-label="Filter by role"
                    className="lg:w-44"
                    value={params.filters.roleId}
                    onValueChange={(roleId) => update({ roleId })}
                    allLabel="All roles"
                    options={(roles.data?.items ?? []).map((r) => ({ value: r.id, label: r.name }))}
                  />
                )}
              </>
            }
          />
        }
        empty={
          hasFilters
            ? { title: "No users match", description: "Try a different search or clear the filters." }
            : {
                title: "No users found",
                description: "Create your first user to get started.",
                action: can("users.create") ? <ButtonLink href="/users/new" size="sm">New user</ButtonLink> : undefined,
              }
        }
        rowActions={(u) => {
          const isSelf = u.id === me?.id;
          return (
            <RowActions label={`Actions for ${fullName(u)}`}>
              <DropdownMenuItem asChild>
                <Link href={`/users/${u.id}`}>
                  <Eye className="size-4" /> View
                </Link>
              </DropdownMenuItem>
              <Can permission="users.update">
                <DropdownMenuItem asChild>
                  <Link href={`/users/${u.id}/edit`}>
                    <Pencil className="size-4" /> Edit
                  </Link>
                </DropdownMenuItem>
                {!isSelf && (
                  <DropdownMenuItem icon={<Power />} onSelect={() => setPending({ type: "status", user: u })}>
                    {u.status === "ACTIVE" ? "Deactivate" : "Activate"}
                  </DropdownMenuItem>
                )}
              </Can>
              {superAdmin && u.status === "ACTIVE" && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    icon={<KeyRound />}
                    onSelect={() => setResetDialog({ type: "send", user: u, resend: resets.data?.get(u.id)?.status === "PENDING" })}
                  >
                    {resets.data?.get(u.id)?.status === "PENDING" ? "Resend password reset" : "Send password reset"}
                  </DropdownMenuItem>
                  {resets.data?.has(u.id) && (
                    <DropdownMenuItem icon={<Eye />} onSelect={() => setResetDialog({ type: "details", user: u })}>
                      View reset status
                    </DropdownMenuItem>
                  )}
                </>
              )}
              {!isSelf && (
                <Can permission="users.delete">
                  <DropdownMenuSeparator />
                  <DropdownMenuItem icon={<Trash2 />} destructive onSelect={() => setPending({ type: "delete", user: u })}>
                    Delete
                  </DropdownMenuItem>
                </Can>
              )}
            </RowActions>
          );
        }}
      />

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        title={
          pending?.type === "delete"
            ? "Delete user?"
            : pending?.user.status === "ACTIVE"
              ? "Deactivate user?"
              : "Activate user?"
        }
        description={
          pending?.type === "delete" ? (
            <>
              <strong className="text-ink">{pending && fullName(pending.user)}</strong> will lose access immediately. This cannot be undone from the UI.
            </>
          ) : pending?.user.status === "ACTIVE" ? (
            <>
              <strong className="text-ink">{pending && fullName(pending.user)}</strong> will be signed out and unable to log in.
            </>
          ) : (
            <>
              <strong className="text-ink">{pending && fullName(pending.user)}</strong> will be able to log in again.
            </>
          )
        }
        confirmLabel={pending?.type === "delete" ? "Delete" : pending?.user.status === "ACTIVE" ? "Deactivate" : "Activate"}
        destructive={pending?.type === "delete" || pending?.user.status === "ACTIVE"}
        loading={deleteUser.isPending || setStatus.isPending}
        onConfirm={() => void confirm()}
      />

      <SendPasswordResetDialog
        member={resetDialog?.type === "send" ? resetDialog.user : null}
        resend={resetDialog?.type === "send" && resetDialog.resend}
        onOpenChange={(open) => !open && setResetDialog(null)}
      />
      <PasswordResetDetailsDialog
        member={resetDialog?.type === "details" ? resetDialog.user : null}
        onOpenChange={(open) => !open && setResetDialog(null)}
        onResend={(user, current) => setResetDialog({ type: "send", user, resend: current?.status === "PENDING" })}
      />
    </div>
  );
}
