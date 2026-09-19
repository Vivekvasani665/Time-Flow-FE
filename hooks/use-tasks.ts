"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { tasksService } from "@/services/tasks.service";
import type { Paginated, Task, TaskInput, TaskListParams, TaskStatus } from "@/types/api";

export function useTasks(params: TaskListParams, enabled = true) {
  return useQuery({
    queryKey: queryKeys.tasks.list(params),
    queryFn: () => tasksService.list(params),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useTask(id: string) {
  return useQuery({ queryKey: queryKeys.tasks.detail(id), queryFn: () => tasksService.get(id) });
}

function useInvalidateTasks() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: queryKeys.tasks.all });
    void qc.invalidateQueries({ queryKey: queryKeys.projects.all });
    void qc.invalidateQueries({ queryKey: queryKeys.dashboard });
  };
}

export function useCreateTask() {
  const invalidate = useInvalidateTasks();
  return useMutation({ mutationFn: (input: TaskInput) => tasksService.create(input), onSuccess: invalidate });
}

export function useUpdateTask(id: string) {
  const invalidate = useInvalidateTasks();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<TaskInput>) => tasksService.update(id, input),
    onSuccess: (task) => {
      qc.setQueryData(queryKeys.tasks.detail(id), task);
      invalidate();
    },
  });
}

type StatusContext = { snapshots: [QueryKey, unknown][] };

/** Optimistic status change: the badge flips instantly and rolls back on error. */
export function useChangeTaskStatus() {
  const qc = useQueryClient();
  const invalidate = useInvalidateTasks();
  return useMutation<Task, Error, { id: string; status: TaskStatus }, StatusContext>({
    mutationFn: ({ id, status }) => tasksService.update(id, { status }),
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: queryKeys.tasks.all });
      const snapshots = qc.getQueriesData({ queryKey: queryKeys.tasks.all });
      qc.setQueriesData<Paginated<Task> | Task>({ queryKey: queryKeys.tasks.all }, (old) => {
        if (!old) return old;
        if ("items" in old) {
          return { ...old, items: old.items.map((t) => (t.id === id ? { ...t, status } : t)) };
        }
        return old.id === id ? { ...old, status } : old;
      });
      return { snapshots };
    },
    onError: (_error, _vars, context) => {
      context?.snapshots.forEach(([key, data]) => qc.setQueryData(key, data));
    },
    onSettled: invalidate,
  });
}

export function useDeleteTask() {
  const invalidate = useInvalidateTasks();
  return useMutation({ mutationFn: (id: string) => tasksService.remove(id), onSuccess: invalidate });
}
