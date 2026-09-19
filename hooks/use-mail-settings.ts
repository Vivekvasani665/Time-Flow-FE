"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { mailSettingsService } from "@/services/mail-settings.service";

export function useMailSettings(enabled = true) {
  return useQuery({ queryKey: queryKeys.mailSettings, queryFn: mailSettingsService.get, enabled });
}

export function useTestMailSettings() {
  return useMutation({ mutationFn: mailSettingsService.test });
}

export function useSaveMailSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: mailSettingsService.save,
    onSuccess: (data) => qc.setQueryData(queryKeys.mailSettings, data),
  });
}

export function useDisableMailSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: mailSettingsService.disable,
    onSuccess: (data) => qc.setQueryData(queryKeys.mailSettings, data),
  });
}
