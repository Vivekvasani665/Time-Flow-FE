import { api, toQuery } from "@/lib/api/client";
import type { Task, TaskInput, TaskListParams } from "@/types/api";

export const tasksService = {
  list: (params: TaskListParams) => api.list<Task>("/tasks", toQuery(params)),
  get: (id: string) => api.get<Task>(`/tasks/${id}`),
  create: async (input: TaskInput) => (await api.post<Task>("/tasks", input)).data,
  update: async (id: string, input: Partial<TaskInput>) => (await api.patch<Task>(`/tasks/${id}`, input)).data,
  remove: async (id: string) => {
    await api.delete<null>(`/tasks/${id}`);
  },
};
