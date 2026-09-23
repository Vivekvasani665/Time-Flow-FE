import { api, request } from "@/lib/api/client";
import type { PasswordResetRequest } from "@/types/api";

export type ResetPasswordInput = { token: string; newPassword: string; confirmPassword: string };

export const passwordResetService = {
  /** Super Admin: emails the member a new link. Any earlier pending link stops working. */
  sendPasswordResetRequest: async (userId: string) =>
    (await api.post<PasswordResetRequest>(`/admin/users/${userId}/password-reset`)).data,

  /** Super Admin: the member's latest request, or null if none was ever sent. */
  getPasswordResetStatus: (userId: string) => api.get<PasswordResetRequest | null>(`/admin/users/${userId}/password-reset`),

  /** Super Admin: latest request for each of the given members; members without one are omitted. */
  listLatest: (userIds: string[]) => api.get<PasswordResetRequest[]>("/admin/password-reset-requests", { userIds: userIds.join(",") }),

  // The two below are public: the member holds a link, not a session, so a 401 must not trigger a refresh.
  verifyPasswordResetToken: async (token: string) =>
    (await request<{ valid: true; expiresAt: string }>("/auth/password-reset/verify", { query: { token }, skipAuthRefresh: true })).data,

  resetPassword: async (input: ResetPasswordInput) => {
    await request<null>("/auth/password-reset", { method: "POST", body: input, skipAuthRefresh: true });
  },
};
