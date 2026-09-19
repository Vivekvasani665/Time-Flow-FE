import { api, request, resetSessionTracking } from "@/lib/api/client";
import type { AuthUser } from "@/types/api";

export type LoginInput = { email: string; password: string };

export const authService = {
  login: async (input: LoginInput) =>
    (await request<{ user: AuthUser }>("/auth/login", { method: "POST", body: input, skipAuthRefresh: true })).data.user,
  logout: async () => {
    try {
      await request<null>("/auth/logout", { method: "POST", skipAuthRefresh: true });
    } finally {
      resetSessionTracking();
    }
  },
  me: () => api.get<AuthUser>("/auth/me"),
};
