"use client";

import type { UseQueryResult } from "@tanstack/react-query";
import { CalendarClock } from "lucide-react";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { PriorityIndicator, TaskStatusBadge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { cn, formatDate, isOverdue } from "@/lib/utils";
import type { Paginated, Task } from "@/types/api";

export function TaskRows({ tasks, showProject = true, showAssignee = false }: { tasks: Task[]; showProject?: boolean; showAssignee?: boolean }) {
  return (
    <ul className="divide-y divide-line">
      {tasks.map((task) => {
        const overdue = isOverdue(task.dueDate, task.status);
        return (
          <li key={task.id}>
            <Link href={`/tasks/${task.id}`} className="group -mx-2 flex items-center gap-3 rounded-md px-2 py-2.5 transition-colors hover:bg-panel-2">
              <PriorityIndicator priority={task.priority} showLabel={false} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{task.title}</p>
                <p className="flex flex-wrap items-center gap-x-3 text-xs text-ink-mute">
                  {showProject && <span className="truncate">{task.project.name}</span>}
                  <span className={cn("tabular inline-flex items-center gap-1", overdue && "text-danger")}>
                    <CalendarClock className="size-3" />
                    {task.dueDate ? formatDate(task.dueDate) : "No due date"}
                    {overdue && " · Overdue"}
                  </span>
                </p>
              </div>
              {showAssignee && <Avatar user={task.assignee} size="xs" />}
              <TaskStatusBadge status={task.status} />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function TaskList({
  query,
  emptyText,
  showProject,
  showAssignee,
}: {
  query: UseQueryResult<Paginated<Task>>;
  emptyText: string;
  showProject?: boolean;
  showAssignee?: boolean;
}) {
  if (query.isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-10" />
        ))}
      </div>
    );
  }
  if (query.error) return <ErrorState error={query.error} onRetry={() => query.refetch()} className="py-6" />;
  const tasks = query.data?.items ?? [];
  if (tasks.length === 0) return <EmptyState title="No tasks" description={emptyText} className="py-8" />;
  return <TaskRows tasks={tasks} showProject={showProject} showAssignee={showAssignee} />;
}
