"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { sessionsService } from "@/services/sessions.service";

export function useSessions() {
  return useQuery({ queryKey: queryKeys.sessions, queryFn: sessionsService.list });
}

export function useRevokeSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: sessionsService.revoke,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.sessions }),
  });
}

export function useRevokeOtherSessions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: sessionsService.revokeOthers,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.sessions }),
  });
}
