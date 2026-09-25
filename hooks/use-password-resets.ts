"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { passwordResetService } from "@/services/password-reset.service";

/** Latest reset request per member on the current page, keyed by user id. */
export function useLatestPasswordResets(userIds: string[], enabled = true) {
  return useQuery({
    queryKey: queryKeys.passwordResets.latest(userIds),
    queryFn: async () => new Map((await passwordResetService.listLatest(userIds)).map((r) => [r.userId, r])),
    enabled: enabled && userIds.length > 0,
    // A pending link can lapse or be used while the table is open.
    refetchInterval: 60_000,
  });
}

export function usePasswordResetStatus(userId: string | null) {
  return useQuery({
    queryKey: queryKeys.passwordResets.user(userId ?? ""),
    queryFn: () => passwordResetService.getPasswordResetStatus(userId!),
    enabled: Boolean(userId),
  });
}

export function useSendPasswordReset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => passwordResetService.sendPasswordResetRequest(userId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: queryKeys.passwordResets.all }),
  });
}
