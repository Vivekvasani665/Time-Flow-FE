import { api, buildQuery, toQuery } from "@/lib/api/client";
import type { ActivityListParams, ActivityLog, ActivityStats } from "@/types/api";

export const activityService = {
  list: (params: ActivityListParams) => api.list<ActivityLog>("/activity-logs", toQuery(params)),
  stats: (params: ActivityListParams) => api.get<ActivityStats>("/activity-logs/stats", toQuery(params)),
  exportUrl: (params: ActivityListParams) => {
    const { page: _page, limit: _limit, ...filters } = params;
    return `/api/activity-logs/export${buildQuery(toQuery(filters))}`;
  },
};
