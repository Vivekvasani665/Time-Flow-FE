"use client";

import { CheckCircle2, FolderKanban, ListChecks, Pencil, Power, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth, usePermissions } from "@/components/auth/auth-provider";
import { Can } from "@/components/auth/can";
import { TaskList } from "@/components/tasks/task-list-compact";
import { Avatar } from "@/components/ui/avatar";
import { RankBadge, UserStatusBadge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataRow, Panel } from "@/components/ui/panel";
import { PageSkeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { useTasks } from "@/hooks/use-tasks";
import { useDeleteUser, useSetUserStatus, useUser } from "@/hooks/use-users";
import { isApiError } from "@/lib/api/client";
import { formatDate, formatDateTime, fullName, shortId } from "@/lib/utils";

export function UserDetail({ id }: { id: string }) {
  const router = useRouter();
  const { user: me } = useAuth();
  const { can } = usePermissions();
  const query = useUser(id);
  const tasks = useTasks({ assigneeId: id, limit: 6, sortBy: "dueDate", sortOrder: "asc" }, can("tasks.view"));
  const deleteUser = useDeleteUser();
  const setStatus = useSetUserStatus();
  const [confirm, setConfirm] = useState<"delete" | "status" | null>(null);

  if (query.isLoading) return <PageSkeleton />;
  if (query.error || !query.data) {
    return <ErrorState title="User unavailable" message={query.error?.message} onRetry={() => void query.refetch()} />;
  }

  const user = query.data;
  const stats = user.stats ?? { assignedTasks: 0, completedTasks: 0, projects: 0 };
  const isSelf = me?.id === user.id;

  const run = async () => {
    try {
      if (confirm === "delete") {
        await deleteUser.mutateAsync(user.id);
        toast.success("User deleted", { description: fullName(user) });
        router.push("/users");
      } else {
        const status = user.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
        await setStatus.mutateAsync({ id: user.id, status });
        await query.refetch();
        toast.success(status === "ACTIVE" ? "User activated" : "User deactivated");
      }
      setConfirm(null);
    } catch (error) {
      toast.error("Action failed", { description: isApiError(error) ? error.message : "Try again." });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header card */}
      <section className="hud-panel clip-corner">
        <div className="flex flex-col gap-5 p-6 md:flex-row md:items-center">
          <Avatar user={user} size="xl" />
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-xs text-ink-mute">
              User ID <span className="font-mono text-ink-dim">{shortId(user.id)}</span>
            </p>
            <h1 className="truncate text-2xl font-semibold tracking-tight text-ink">{fullName(user)}</h1>
            <div className="flex flex-wrap items-center gap-3">
              <RankBadge roleName={user.role.name} />
              <UserStatusBadge status={user.status} />
              <span className="text-sm text-ink-dim">{user.email}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 md:flex-col lg:flex-row">
            <Can permission="users.update">
              <ButtonLink href={`/users/${user.id}/edit`} variant="secondary" icon={<Pencil className="size-4" />}>
                Edit
              </ButtonLink>
              {!isSelf && (
                <Button variant="secondary" icon={<Power className="size-4" />} onClick={() => setConfirm("status")}>
                  {user.status === "ACTIVE" ? "Deactivate" : "Activate"}
                </Button>
              )}
            </Can>
            {!isSelf && (
              <Can permission="users.delete">
                <Button variant="danger" icon={<Trash2 className="size-4" />} onClick={() => setConfirm("delete")}>
                  Delete
                </Button>
              </Can>
            )}
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Assigned tasks", value: stats.assignedTasks, icon: ListChecks },
          { label: "Completed tasks", value: stats.completedTasks, icon: CheckCircle2 },
          { label: "Projects", value: stats.projects, icon: FolderKanban },
        ].map((s) => (
          <div key={s.label} className="hud-panel clip-corner p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-ink-mute">{s.label}</p>
              <s.icon className="size-4 text-ink-mute" aria-hidden="true" />
            </div>
            <p className="tabular mt-2 text-2xl font-semibold tracking-tight text-ink">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <Panel title="Profile">
          <dl>
            <DataRow label="First name">{user.firstName}</DataRow>
            <DataRow label="Last name">{user.lastName}</DataRow>
            <DataRow label="Email">{user.email}</DataRow>
            <DataRow label="Phone">
              <span className="tabular">{user.phone ?? "—"}</span>
            </DataRow>
            <DataRow label="Role">{user.role.name}</DataRow>
            <DataRow label="Last login">
              <span className="tabular text-sm">{formatDateTime(user.lastLoginAt)}</span>
            </DataRow>
            <DataRow label="Created">
              <span className="tabular text-sm">{formatDate(user.createdAt)}</span>
            </DataRow>
            <DataRow label="Updated">
              <span className="tabular text-sm">{formatDateTime(user.updatedAt)}</span>
            </DataRow>
          </dl>
        </Panel>
        <Can permission="tasks.view">
          <Panel title="Assigned tasks" icon={<ListChecks />}>
            <TaskList query={tasks} emptyText="No tasks assigned to this user." />
          </Panel>
        </Can>
      </div>

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={confirm === "delete" ? "Delete user?" : user.status === "ACTIVE" ? "Deactivate user?" : "Activate user?"}
        description={
          confirm === "delete"
            ? `${fullName(user)} will lose access immediately.`
            : user.status === "ACTIVE"
              ? `${fullName(user)} will be signed out and unable to log in.`
              : `${fullName(user)} will be able to log in again.`
        }
        confirmLabel={confirm === "delete" ? "Delete" : user.status === "ACTIVE" ? "Deactivate" : "Activate"}
        destructive={confirm === "delete" || user.status === "ACTIVE"}
        loading={deleteUser.isPending || setStatus.isPending}
        onConfirm={() => void run()}
      />
    </div>
  );
}
