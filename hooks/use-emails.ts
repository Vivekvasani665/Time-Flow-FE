"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { emailService, type ComposeInput, type EmailListParams } from "@/services/email.service";

export function useEmails(params: EmailListParams, enabled = true) {
  return useQuery({
    queryKey: queryKeys.emails.list(params),
    queryFn: () => emailService.list(params),
    refetchInterval: 5_000,
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useEmail(id: string | null) {
  return useQuery({
    queryKey: queryKeys.emails.detail(id ?? ""),
    queryFn: () => emailService.get(id!),
    enabled: Boolean(id),
  });
}

/** Powers the System Monitor strip and the sidebar unread badge. */
export function useEmailStats(enabled = true) {
  return useQuery({ queryKey: queryKeys.emails.stats, queryFn: emailService.stats, refetchInterval: 5_000, enabled });
}

export function useSendEmail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ComposeInput) => emailService.send(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.emails.all }),
  });
}

/** "Check for replies": the poll runs in the worker, so refresh once it has had time to finish. */
export function useSyncInbox() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: emailService.syncInbox,
    onSuccess: () => {
      setTimeout(() => void qc.invalidateQueries({ queryKey: queryKeys.emails.all }), 4_000);
    },
  });
}

export function useDeleteEmail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => emailService.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.emails.all }),
  });
}

export function useMarkEmailRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, read }: { id: string; read: boolean }) => emailService.markRead(id, read),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.emails.all }),
  });
}
