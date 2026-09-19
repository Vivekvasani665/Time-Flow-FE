"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useAuth, usePermissions } from "@/components/auth/auth-provider";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { useProject } from "@/hooks/use-projects";
import { useCreateTask, useTask, useUpdateTask } from "@/hooks/use-tasks";
import { toDateInput } from "@/lib/utils";
import type { TaskInput } from "@/types/api";
import { TaskForm } from "./task-form";

export function CreateTask() {
  const router = useRouter();
  const params = useSearchParams();
  const create = useCreateTask();
  return (
    <div className="space-y-6">
      <PageHeader kicker="Tasks" title="Create task" description="Describe the work and assign it to a project member." />
      <TaskForm
        mode="create"
        defaultValues={{ projectId: params.get("projectId") ?? "" }}
        onSubmit={async (payload) => {
          const task = await create.mutateAsync(payload as TaskInput);
          toast.success("Task created", { description: task.title });
          router.push(`/tasks/${task.id}`);
        }}
      />
    </div>
  );
}

/** Full edit requires tasks.view_all or managing the task's project; otherwise status-only. */
export function useCanFullyEditTask(projectId: string | undefined) {
  const { user } = useAuth();
  const { can } = usePermissions();
  const viewAll = can("tasks.view_all");
  const project = useProject(projectId ?? "", !viewAll && Boolean(projectId) && can("projects.view"));
  return { canFullEdit: viewAll || project.data?.manager.id === user?.id, isResolving: !viewAll && project.isLoading };
}

export function EditTask({ id }: { id: string }) {
  const router = useRouter();
  const query = useTask(id);
  const update = useUpdateTask(id);
  const { canFullEdit, isResolving } = useCanFullyEditTask(query.data?.project.id);

  if (query.isLoading || isResolving) return <PageSkeleton />;
  if (query.error || !query.data) return <ErrorState title="Task unavailable" message={query.error?.message} onRetry={() => void query.refetch()} />;
  const t = query.data;

  return (
    <div className="space-y-6">
      <PageHeader kicker="Tasks" title={`Edit ${t.title}`} />
      <TaskForm
        key={t.updatedAt}
        mode="edit"
        statusOnly={!canFullEdit}
        knownProject={t.project}
        knownAssignee={t.assignee}
        defaultValues={{
          title: t.title,
          description: t.description ?? "",
          projectId: t.project.id,
          assigneeId: t.assignee?.id ?? "",
          status: t.status,
          priority: t.priority,
          dueDate: toDateInput(t.dueDate),
        }}
        onSubmit={async (payload) => {
          const updated = await update.mutateAsync(payload);
          toast.success("Task updated", { description: updated.title });
          router.push(`/tasks/${id}`);
        }}
      />
    </div>
  );
}
