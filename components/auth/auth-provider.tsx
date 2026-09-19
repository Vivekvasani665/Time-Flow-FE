"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { queryKeys } from "@/lib/query-keys";
import { authService } from "@/services/auth.service";
import type { AuthUser } from "@/types/api";

type AuthContextValue = {
  user: AuthUser | null;
  isLoading: boolean;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { data, isLoading } = useQuery({ queryKey: queryKeys.me, queryFn: authService.me, staleTime: 60_000 });

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } finally {
      queryClient.clear();
      router.replace("/login");
      router.refresh();
    }
  }, [queryClient, router]);

  const value = useMemo(() => ({ user: data ?? null, isLoading, logout }), [data, isLoading, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

/**
 * Permission checks for UX only (hiding buttons, menu items). The API enforces
 * every permission independently.
 */
export function usePermissions() {
  const { user } = useAuth();
  return useMemo(() => {
    const set = new Set(user?.permissions ?? []);
    return {
      permissions: set,
      can: (key: string) => set.has(key),
      canAny: (...keys: string[]) => keys.some((k) => set.has(k)),
      canAll: (...keys: string[]) => keys.every((k) => set.has(k)),
    };
  }, [user]);
}
