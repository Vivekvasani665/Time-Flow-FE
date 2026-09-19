"use client";

import { Lock, Trash2, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { usePermissions } from "@/components/auth/auth-provider";
import { Can } from "@/components/auth/can";
import { Avatar } from "@/components/ui/avatar";
import { Badge, RankBadge, UserStatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { Panel } from "@/components/ui/panel";
import { PageSkeleton, Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCreateRole, useDeleteRole, usePermissionCatalog, useRole, useRoleUsers, useUpdateRole } from "@/hooks/use-roles";
import { isApiError } from "@/lib/api/client";
import { formatDateTime, fullName } from "@/lib/utils";
import { RoleForm } from "./role-form";

export function CreateRole() {
  const router = useRouter();
  const { permissions } = usePermissions();
  const catalog = usePermissionCatalog();
  const create = useCreateRole();

  if (catalog.isLoading) return <PageSkeleton />;
  if (catalog.error) return <ErrorState message={catalog.error.message} onRetry={() => void catalog.refetch()} />;

  return (
    <div className="space-y-6">
      <PageHeader kicker="Roles" title="Create role" description="Name the role and choose its permissions." />
      <RoleForm
        catalog={catalog.data ?? []}
        grantable={permissions}
        submitLabel="Create role"
        onSubmit={async (payload) => {
          const role = await create.mutateAsync(payload);
          toast.success("Role created", { description: role.name });
          router.push(`/roles/${role.id}`);
        }}
      />
    </div>
  );
}

export function RoleDetail({ id }: { id: string }) {
  const router = useRouter();
  const { can, permissions } = usePermissions();
  const role = useRole(id);
  const catalog = usePermissionCatalog();
  const updateRole = useUpdateRole(id);
  const deleteRole = useDeleteRole();
  const [page, setPage] = useState(1);
  const users = useRoleUsers(id, { page, limit: 10 });
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (role.isLoading || catalog.isLoading) return <PageSkeleton />;
  if (role.error || !role.data) return <ErrorState title="Role unavailable" message={role.error?.message} onRetry={() => void role.refetch()} />;

  const r = role.data;
  const isSuperAdmin = r.isSystem && r.name.toLowerCase() === "super admin";
  const readOnly = !can("roles.update");

  const doDelete = async () => {
    try {
      await deleteRole.mutateAsync(r.id);
      toast.success("Role deleted", { description: r.name });
      router.push("/roles");
    } catch (error) {
      toast.error("Cannot delete role", { description: isApiError(error) ? error.message : "Try again." });
      setConfirmDelete(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Roles"
        title={r.name}
        description={
          <span className="flex flex-wrap items-center gap-3">
            <RankBadge roleName={r.name} />
            {r.isSystem && (
              <Badge tone="gray">
                <Lock className="size-2.5" /> System role
              </Badge>
            )}
            <span className="tabular text-xs text-ink-mute">Updated {formatDateTime(r.updatedAt)}</span>
          </span>
        }
        actions={
          !r.isSystem && (
            <Can permission="roles.delete">
              <Button variant="danger" icon={<Trash2 className="size-4" />} onClick={() => setConfirmDelete(true)}>
                Delete
              </Button>
            </Can>
          )
        }
      />

      <Tabs defaultValue="permissions">
        <TabsList>
          <TabsTrigger value="permissions">Permissions</TabsTrigger>
          <TabsTrigger value="users">
            Assigned users <span className="tabular ml-1 rounded-full bg-panel-3 px-1.5 text-xs text-ink-dim">{r.userCount}</span>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="permissions">
          <RoleForm
            key={r.updatedAt}
            catalog={catalog.data ?? []}
            readOnly={readOnly}
            lockName={r.isSystem}
            lockPermissions={isSuperAdmin}
            grantable={permissions}
            submitLabel="Save role"
            defaultValues={{ name: r.name, description: r.description ?? "", permissions: r.permissions }}
            onSubmit={async (payload) => {
              await updateRole.mutateAsync(r.isSystem ? { description: payload.description, permissions: isSuperAdmin ? undefined : payload.permissions } : payload);
              toast.success("Role updated", { description: "Permission changes apply to all assigned users immediately." });
            }}
          />
        </TabsContent>
        <TabsContent value="users">
          <Panel title="Assigned users" icon={<Users />} bodyClassName="p-0">
            {users.isLoading ? (
              <div className="space-y-3 p-5">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12" />
                ))}
              </div>
            ) : users.error ? (
              <ErrorState message={users.error.message} onRetry={() => void users.refetch()} />
            ) : !users.data || users.data.items.length === 0 ? (
              <EmptyState title="No users assigned" description="Assign this role from the user form." />
            ) : (
              <>
                <ul className="divide-y divide-line">
                  {users.data.items.map((u) => (
                    <li key={u.id}>
                      <Link href={`/users/${u.id}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-panel-2">
                        <Avatar user={u} size="md" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-ink">{fullName(u)}</p>
                          <p className="truncate text-sm text-ink-mute">{u.email}</p>
                        </div>
                        <UserStatusBadge status={u.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
                <div className="border-t border-line px-5 py-3">
                  <Pagination meta={users.data.meta} onPageChange={setPage} />
                </div>
              </>
            )}
          </Panel>
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete role?"
        description={r.userCount > 0 ? `${r.userCount} user(s) still hold this role. Reassign them first.` : `${r.name} will be permanently removed.`}
        confirmLabel="Delete"
        loading={deleteRole.isPending}
        onConfirm={() => void doDelete()}
      />
    </div>
  );
}
