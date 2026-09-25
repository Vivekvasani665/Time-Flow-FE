"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { twoFactorService } from "@/services/two-factor.service";

export function useTwoFactorStatus() {
  return useQuery({ queryKey: queryKeys.twoFactor, queryFn: twoFactorService.status });
}

/**
 * Every 2FA change goes through here. Status and /auth/me both carry the on/off
 * flag, so both are refreshed after any of them.
 */
function useTwoFactorMutation<TVars, TData>(mutationFn: (vars: TVars) => Promise<TData>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => Promise.all([qc.invalidateQueries({ queryKey: queryKeys.twoFactor }), qc.invalidateQueries({ queryKey: queryKeys.me })]),
  });
}

export const useTwoFactorSetup = () => useTwoFactorMutation(twoFactorService.setup);
export const useCancelTwoFactorSetup = () => useTwoFactorMutation(twoFactorService.cancelSetup);
export const useEnableTwoFactor = () => useTwoFactorMutation(twoFactorService.enable);
export const useRemoveTotp = () => useTwoFactorMutation(twoFactorService.removeTotp);
export const useDisableTwoFactor = () => useTwoFactorMutation(twoFactorService.disable);
export const useRegenerateRecoveryCodes = () => useTwoFactorMutation(twoFactorService.regenerateRecoveryCodes);
export const useRemovePasskey = () => useTwoFactorMutation(twoFactorService.removePasskey);
export const useAddPasskey = () => useTwoFactorMutation(twoFactorService.addPasskey);
