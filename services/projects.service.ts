import { api, toQuery } from "@/lib/api/client";
import type { Project, ProjectInput, ProjectListParams, ProjectStats } from "@/types/api";

export const projectsService = {
  list: (params: ProjectListParams) => api.list<Project>("/projects", toQuery(params)),
  stats: () => api.get<ProjectStats>("/projects/stats"),
  get: (id: string) => api.get<Project>(`/projects/${id}`),
  create: async (input: ProjectInput) => (await api.post<Project>("/projects", input)).data,
  update: async (id: string, input: Partial<ProjectInput>) =>
    (await api.patch<Project>(`/projects/${id}`, input)).data,
  remove: async (id: string) => {
    await api.delete<null>(`/projects/${id}`);
  },
};
