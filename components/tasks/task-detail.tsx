"use client";

import { CalendarClock, FolderKanban, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth, usePermissions } from "@/components/auth/auth-provider";
import { Avatar } from "@/components/ui/avatar";
import { PriorityIndicator, TaskStatusBadge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataRow, Panel } from "@/components/ui/panel";
import { PageSkeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { useDeleteTask, useTask } from "@/hooks/use-tasks";
import { cn, formatDate, formatDateTime, fullName, isOverdue } from "@/lib/utils";
import { StatusSwitcher } from "./status-switcher";
import { useCanFullyEditTask } from "./task-editor";
import { notifyError } from "@/lib/notify";

export function TaskDetail({ id }: { id: string }) {
  const router = useRouter();
  const { user: me } = useAuth();
  const { can } = usePermissions();
  const query = useTask(id);
  const remove = useDeleteTask();
  const [confirm, setConfirm] = useState(false);
  const { canFullEdit } = useCanFullyEditTask(query.data?.project.id);

  if (query.isLoading) return <PageSkeleton />;
  if (query.error || !query.data) return <ErrorState title="Task unavailable" error={query.error} onRetry={() => query.refetch()} />;

  const t = query.data;
  const overdue = isOverdue(t.dueDate, t.status);
  const canChangeStatus = can("tasks.update") && (canFullEdit || t.assignee?.id === me?.id);

  const doDelete = async () => {
    try {
      await remove.mutateAsync(t.id);
      toast.success("Task deleted", { description: t.title });
      router.push("/tasks");
    } catch (error) {
      notifyError(error, { title: "Delete failed" });
      setConfirm(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="hud-panel clip-corner">
        <div className="flex flex-col gap-4 p-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-3">
            <Link href={`/projects/${t.project.id}`} className="inline-flex items-center gap-1.5 text-sm text-ink-mute hover:text-ink">
              <FolderKanban className="size-4" /> {t.project.name}
            </Link>
            <h1 className="text-2xl font-semibold tracking-tight text-ink">{t.title}</h1>
            <div className="flex flex-wrap items-center gap-3">
              <TaskStatusBadge status={t.status} />
              <PriorityIndicator priority={t.priority} />
              <span className={cn("tabular inline-flex items-center gap-1.5 text-sm", overdue ? "text-danger" : "text-ink-dim")}>
                <CalendarClock className="size-4" /> {t.dueDate ? `Due ${formatDate(t.dueDate)}` : "No due date"}
                {overdue && " · Overdue"}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {can("tasks.update") && (canFullEdit || t.assignee?.id === me?.id) && (
              <ButtonLink href={`/tasks/${t.id}/edit`} variant="secondary" icon={<Pencil className="size-4" />}>
                Edit
              </ButtonLink>
            )}
            {can("tasks.delete") && (
              <Button variant="secondary" className="text-danger hover:text-danger" icon={<Trash2 className="size-4" />} onClick={() => setConfirm(true)}>
                Delete
              </Button>
            )}
          </div>
        </div>
      </section>

      <Panel title="Status" subtitle={canChangeStatus ? "Select a status to update it immediately" : "You can’t change the status of this task"}>
        <StatusSwitcher task={t} disabled={!canChangeStatus} />
      </Panel>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Panel title="Description">
          {t.description ? (
            <p className="text-sm leading-relaxed whitespace-pre-line text-ink-dim">{t.description}</p>
          ) : (
            <p className="text-sm text-ink-mute">No description provided.</p>
          )}
        </Panel>
        <Panel title="Details">
          <dl>
            <DataRow label="Assignee">
              <span className="inline-flex items-center gap-2">
                <Avatar user={t.assignee} size="xs" /> {fullName(t.assignee)}
              </span>
            </DataRow>
            <DataRow label="Created by">{t.createdBy ? fullName(t.createdBy) : "—"}</DataRow>
            <DataRow label="Due date">
              <span className="tabular text-sm">{formatDate(t.dueDate)}</span>
            </DataRow>
            <DataRow label="Completed">
              <span className="tabular text-sm">{formatDateTime(t.completedAt)}</span>
            </DataRow>
            <DataRow label="Created">
              <span className="tabular text-sm">{formatDateTime(t.createdAt)}</span>
            </DataRow>
            <DataRow label="Updated">
              <span className="tabular text-sm">{formatDateTime(t.updatedAt)}</span>
            </DataRow>
          </dl>
        </Panel>
      </div>

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Delete task?"
        description={`"${t.title}" will be removed from ${t.project.name}.`}
        confirmLabel="Delete task"
        loading={remove.isPending}
        onConfirm={() => void doDelete()}
      />
    </div>
  );
}
