"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { systemService } from "@/services/system.service";
import type { JobState } from "@/types/api";

export function useQueues() {
  return useQuery({ queryKey: queryKeys.system.queues, queryFn: systemService.queues, refetchInterval: 5_000 });
}

export function useQueueJobs(name: string, state: JobState) {
  return useQuery({
    queryKey: queryKeys.system.jobs(name, state),
    queryFn: () => systemService.jobs(name, state),
    refetchInterval: 5_000,
    placeholderData: keepPreviousData,
  });
}

export function useRetryJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, id }: { name: string; id: string }) => systemService.retry(name, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["system"] }),
  });
}

