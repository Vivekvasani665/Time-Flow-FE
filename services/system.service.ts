import { api } from "@/lib/api/client";
import type { JobState, QueueJob, QueueSummary } from "@/types/api";

export const systemService = {
  queues: () => api.get<QueueSummary[]>("/queues"),
  jobs: (name: string, state: JobState) => api.get<QueueJob[]>(`/queues/${name}/jobs`, { state }),
  retry: async (name: string, id: string) => {
    await api.post<null>(`/queues/${encodeURIComponent(name)}/jobs/${encodeURIComponent(id)}/retry`);
  },
};
