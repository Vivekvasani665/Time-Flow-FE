"use client";

import { CalendarRange, ListPlus, Pencil, Trash2, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth, usePermissions } from "@/components/auth/auth-provider";
import { TaskList } from "@/components/tasks/task-list-compact";
import { Avatar } from "@/components/ui/avatar";
import { PriorityIndicator, ProjectStatusBadge, TaskStatusBadge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataRow, Panel } from "@/components/ui/panel";
import { PageSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { XpBar } from "@/components/ui/xp-bar";
import { useDeleteProject, useProject } from "@/hooks/use-projects";
import { useTasks } from "@/hooks/use-tasks";
import { TASK_STATUSES } from "@/lib/labels";
import { formatDate, formatDateTime, fullName, percent } from "@/lib/utils";
import { notifyError } from "@/lib/notify";

export function ProjectDetail({ id }: { id: string }) {
  const router = useRouter();
  const { user: me } = useAuth();
  const { can } = usePermissions();
  const query = useProject(id);
  const tasks = useTasks({ projectId: id, limit: 50, sortBy: "dueDate", sortOrder: "asc" }, can("tasks.view"));
  const remove = useDeleteProject();
  const [confirm, setConfirm] = useState(false);

  if (query.isLoading) return <PageSkeleton />;
  if (query.error || !query.data) return <ErrorState title="Project unavailable" error={query.error} onRetry={() => query.refetch()} />;

  const p = query.data;
  const progress = percent(p.taskStats.completed, p.taskStats.total);
  const manages = can("projects.view_all") || p.manager.id === me?.id;
  const statusCounts = TASK_STATUSES.map((s) => ({ status: s, count: (tasks.data?.items ?? []).filter((t) => t.status === s).length }));

  const doDelete = async () => {
    try {
      await remove.mutateAsync(p.id);
      toast.success("Project deleted", { description: p.name });
      router.push("/projects");
    } catch (error) {
      notifyError(error, { title: "Delete failed" });
      setConfirm(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="hud-panel clip-corner">
        <div className="space-y-5 p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 space-y-3">
              <h1 className="text-2xl font-semibold tracking-tight text-ink">{p.name}</h1>
              <div className="flex flex-wrap items-center gap-3">
                <ProjectStatusBadge status={p.status} />
                <PriorityIndicator priority={p.priority} />
                <span className="tabular inline-flex items-center gap-1.5 text-sm text-ink-dim">
                  <CalendarRange className="size-4 text-ink-mute" /> {formatDate(p.startDate)} – {formatDate(p.endDate)}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {can("tasks.create") && (
                <ButtonLink href={`/tasks/new?projectId=${p.id}`} icon={<ListPlus className="size-4" />}>
                  Add task
                </ButtonLink>
              )}
              {can("projects.update") && manages && (
                <ButtonLink href={`/projects/${p.id}/edit`} variant="secondary" icon={<Pencil className="size-4" />}>
                  Edit
                </ButtonLink>
              )}
              {can("projects.delete") && manages && (
                <Button variant="secondary" className="text-danger hover:text-danger" icon={<Trash2 className="size-4" />} onClick={() => setConfirm(true)}>
                  Delete
                </Button>
              )}
            </div>
          </div>
          <div className="border-t border-line pt-5">
            <div className="mb-2 flex justify-between text-sm">
              <span className="font-medium text-ink">Progress</span>
              <span className="tabular text-ink-mute">
                {p.taskStats.completed} of {p.taskStats.total} tasks completed
              </span>
            </div>
            <XpBar value={progress} label="Project progress" />
          </div>
        </div>
      </section>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          {can("tasks.view") && (
            <TabsTrigger value="tasks">
              Tasks <span className="tabular rounded-full bg-panel-3 px-1.5 text-xs text-ink-dim">{p.taskStats.total}</span>
            </TabsTrigger>
          )}
          <TabsTrigger value="members">
            Members <span className="tabular rounded-full bg-panel-3 px-1.5 text-xs text-ink-dim">{p.members.length + 1}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
            <Panel title="Description">
              {p.description ? (
                <p className="text-sm leading-relaxed whitespace-pre-line text-ink-dim">{p.description}</p>
              ) : (
                <p className="text-sm text-ink-mute">No description provided.</p>
              )}
              {can("tasks.view") && (
                <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {statusCounts.map((s) => (
                    <div key={s.status} className="rounded-lg border border-line bg-panel-2 p-3">
                      <p className="tabular text-2xl font-semibold text-ink">{s.count}</p>
                      <div className="mt-1">
                        <TaskStatusBadge status={s.status} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
            <Panel title="Details">
              <dl>
                <DataRow label="Manager">
                  <span className="inline-flex items-center gap-2">
                    <Avatar user={p.manager} size="xs" /> {fullName(p.manager)}
                  </span>
                </DataRow>
                <DataRow label="Start date">
                  <span className="tabular text-sm">{formatDate(p.startDate)}</span>
                </DataRow>
                <DataRow label="End date">
                  <span className="tabular text-sm">{formatDate(p.endDate)}</span>
                </DataRow>
                <DataRow label="Created">
                  <span className="tabular text-sm">{formatDateTime(p.createdAt)}</span>
                </DataRow>
                <DataRow label="Updated">
                  <span className="tabular text-sm">{formatDateTime(p.updatedAt)}</span>
                </DataRow>
              </dl>
            </Panel>
          </div>
        </TabsContent>

        {can("tasks.view") && (
          <TabsContent value="tasks">
            <Panel
              title="Tasks"
              actions={
                <Link href={`/tasks?projectId=${p.id}`} className="text-sm font-medium text-cyan hover:underline">
                  View all tasks
                </Link>
              }
            >
              <TaskList query={tasks} emptyText="No tasks yet for this project." showProject={false} showAssignee />
            </Panel>
          </TabsContent>
        )}

        <TabsContent value="members">
          <Panel title="Team members" icon={<Users />} bodyClassName="p-0">
            <ul className="divide-y divide-line">
              <MemberRow user={p.manager} lead />
              {p.members.map((m) => (
                <MemberRow key={m.id} user={m} />
              ))}
            </ul>
            {p.members.length === 0 && <EmptyState title="No members" description="Only the manager is assigned." className="py-8" />}
          </Panel>
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Delete project?"
        description={`${p.name} and its ${p.taskStats.total} task(s) will be removed.`}
        confirmLabel="Delete project"
        loading={remove.isPending}
        onConfirm={() => void doDelete()}
      />
    </div>
  );
}

function MemberRow({ user, lead }: { user: { id: string; firstName: string; lastName: string; email: string; avatarUrl: string | null }; lead?: boolean }) {
  const { can } = usePermissions();
  const content = (
    <>
      <Avatar user={user} size="md" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{fullName(user)}</p>
        <p className="truncate text-sm text-ink-mute">{user.email}</p>
      </div>
      {lead && (
        <span className="inline-flex items-center rounded-full border border-line-bright bg-panel-3 px-2 py-0.5 text-xs font-medium text-ink-dim">
          Manager
        </span>
      )}
    </>
  );
  return (
    <li>
      {can("users.view") ? (
        <Link href={`/users/${user.id}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-panel-2">
          {content}
        </Link>
      ) : (
        <div className="flex items-center gap-3 px-5 py-3">{content}</div>
      )}
    </li>
  );
}
