"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { activityService } from "@/services/activity.service";
import type { ActivityListParams } from "@/types/api";

export function useActivityLogs(params: ActivityListParams) {
  return useQuery({
    queryKey: queryKeys.activity.list(params),
    queryFn: () => activityService.list(params),
    placeholderData: keepPreviousData,
  });
}
