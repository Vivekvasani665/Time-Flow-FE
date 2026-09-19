"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { dashboardService } from "@/services/dashboard.service";

export function useDashboard() {
  return useQuery({ queryKey: queryKeys.dashboard, queryFn: dashboardService.get });
}
