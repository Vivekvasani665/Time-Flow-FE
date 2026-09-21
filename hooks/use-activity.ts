"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { activityService } from "@/services/activity.service";
import type { ActivityListParams } from "@/types/api";

export function useActivityStats(params: ActivityListParams) {
  const { page: _page, limit: _limit, sortBy: _sortBy, sortOrder: _sortOrder, ...filters } = params;
  return useQuery({
    queryKey: queryKeys.activity.stats(filters),
    queryFn: () => activityService.stats(filters),
    placeholderData: keepPreviousData,
  });
}

export function useActivityLogs(params: ActivityListParams) {
  return useQuery({
    queryKey: queryKeys.activity.list(params),
    queryFn: () => activityService.list(params),
    placeholderData: keepPreviousData,
  });
}
