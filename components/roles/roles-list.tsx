"use client";

import { Eye, Lock, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { usePermissions } from "@/components/auth/auth-provider";
import { Can } from "@/components/auth/can";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { RowActions } from "@/components/data-table/row-actions";
import { TableToolbar } from "@/components/data-table/table-toolbar";
import { Badge, RankBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/ui/page-header";
import { useDeleteRole, usePermissionCatalog, useRoles } from "@/hooks/use-roles";
import { useTableParams } from "@/hooks/use-table-params";
import { isApiError } from "@/lib/api/client";
import { formatDate } from "@/lib/utils";
import type { Role } from "@/types/api";

export function RolesList() {
  const { can } = usePermissions();
  const { params, apiParams, update, toggleSort } = useTableParams([] as const, { sortBy: "name" });
  const query = useRoles(apiParams);
  const catalog = usePermissionCatalog();
  const deleteRole = useDeleteRole();
  const [pending, setPending] = useState<Role | null>(null);
  const totalPerms = catalog.data?.length ?? 0;

  const columns: Column<Role>[] = [
    {
      key: "name",
      header: "Role",
      sortKey: "name",
      primary: true,
      cell: (r) => (
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <RankBadge roleName={r.name} />
            {r.isSystem && (
              <Badge tone="gray">
                <Lock className="size-2.5" /> System
              </Badge>
            )}
          </div>
          {r.description && <p className="truncate text-sm text-ink-mute">{r.description}</p>}
        </div>
      ),
    },
    {
      key: "permissions",
      header: "Permissions",
      cell: (r) => (
        <div className="flex items-center gap-3">
          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-panel-3">
            <div className="h-full rounded-full bg-cyan" style={{ width: `${totalPerms ? (r.permissions.length / totalPerms) * 100 : 0}%` }} />
          </div>
          <span className="tabular text-xs text-ink-dim">
            {r.permissions.length}
            {totalPerms ? `/${totalPerms}` : ""}
          </span>
        </div>
      ),
    },
    { key: "users", header: "Users", cell: (r) => <span className="tabular text-sm text-ink-dim">{r.userCount}</span> },
    { key: "createdAt", header: "Created", sortKey: "createdAt", hideOnMobile: true, cell: (r) => <span className="tabular text-xs text-ink-dim">{formatDate(r.createdAt)}</span> },
  ];

  const confirmDelete = async () => {
    if (!pending) return;
    try {
      await deleteRole.mutateAsync(pending.id);
      toast.success("Role deleted", { description: pending.name });
      setPending(null);
    } catch (error) {
      toast.error("Cannot delete role", { description: isApiError(error) ? error.message : "Try again." });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Roles & Permissions"
        description="Define what each role can see and do. Permissions are enforced on the server."
        actions={
          <Can permission="roles.create">
            <ButtonLink href="/roles/new" icon={<Plus className="size-4" />}>
              New role
            </ButtonLink>
          </Can>
        }
      />
      <DataTable
        caption="Roles"
        columns={columns}
        data={query.data?.items}
        meta={query.data?.meta}
        getRowId={(r) => r.id}
        isLoading={query.isLoading}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        sortBy={params.sortBy}
        sortOrder={params.sortOrder}
        onSort={toggleSort}
        onPageChange={(page) => update({ page }, false)}
        onLimitChange={(limit) => update({ limit })}
        rowHref={(r) => `/roles/${r.id}`}
        toolbar={<TableToolbar search={params.search} onSearch={(search) => update({ search })} placeholder="Search roles…" />}
        empty={{
          title: params.search ? "No roles match" : "No roles found",
          description: params.search ? "Try a different search." : "Create your first role to get started.",
          action: !params.search && can("roles.create") ? <ButtonLink href="/roles/new" size="sm">New role</ButtonLink> : undefined,
        }}
        rowActions={(r) => (
          <RowActions label={`Actions for ${r.name}`}>
            <DropdownMenuItem asChild>
              <Link href={`/roles/${r.id}`}>
                <Eye className="size-4" /> {can("roles.update") ? "View & edit" : "View"}
              </Link>
            </DropdownMenuItem>
            {!r.isSystem && (
              <Can permission="roles.delete">
                <DropdownMenuSeparator />
                <DropdownMenuItem icon={<Trash2 />} destructive onSelect={() => setPending(r)}>
                  Delete
                </DropdownMenuItem>
              </Can>
            )}
          </RowActions>
        )}
      />
      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        title="Delete role?"
        description={
          pending && pending.userCount > 0
            ? `${pending.name} is assigned to ${pending.userCount} user(s). Reassign them first — the server will reject this.`
            : `${pending?.name ?? "This role"} will be permanently removed.`
        }
        confirmLabel="Delete"
        loading={deleteRole.isPending}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
