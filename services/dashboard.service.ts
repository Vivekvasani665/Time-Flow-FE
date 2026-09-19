import { api } from "@/lib/api/client";
import type { DashboardData } from "@/types/api";

export const dashboardService = {
  get: () => api.get<DashboardData>("/dashboard"),
};
