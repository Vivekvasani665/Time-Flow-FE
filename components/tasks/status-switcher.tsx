"use client";

import { toast } from "sonner";
import { useChangeTaskStatus } from "@/hooks/use-tasks";
import { TASK_STATUS, TASK_STATUSES } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { Task, TaskStatus } from "@/types/api";
import { TONE } from "@/components/ui/tone";
import { notifyError } from "@/lib/notify";

/** Segmented status control; changes apply immediately with optimistic updates. */
export function StatusSwitcher({ task, disabled }: { task: Pick<Task, "id" | "status" | "title">; disabled?: boolean }) {
  const change = useChangeTaskStatus();

  const select = (status: TaskStatus) => {
    if (status === task.status) return;
    change.mutate(
      { id: task.id, status },
      {
        onSuccess: () => toast.success("Status updated", { description: `${task.title} → ${TASK_STATUS[status].label}` }),
        onError: (error) => notifyError(error, { title: "Status change failed" }),
      },
    );
  };

  return (
    <div role="radiogroup" aria-label="Task status" className="grid grid-cols-2 gap-1 rounded-lg border border-line bg-panel-2 p-1 sm:grid-cols-4">
      {TASK_STATUSES.map((status) => {
        const meta = TASK_STATUS[status];
        const active = task.status === status;
        const tone = TONE[meta.tone];
        return (
          <button
            key={status}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => select(status)}
            className={cn(
              "flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
              active ? "bg-panel text-ink shadow-sm ring-1 ring-line" : "text-ink-mute hover:bg-panel-3 hover:text-ink",
            )}
          >
            <span className={cn("size-2 rounded-full", active ? tone.dot : "bg-line-bright")} aria-hidden="true" />
            {meta.label}
          </button>
        );
      })}
    </div>
  );
}
