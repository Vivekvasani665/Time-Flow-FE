import { api } from "@/lib/api/client";
import type { Session } from "@/types/api";

export const sessionsService = {
  list: () => api.get<Session[]>("/auth/me/sessions"),
  revoke: async (familyId: string) => {
    await api.delete<null>(`/auth/me/sessions/${familyId}`);
  },
  revokeOthers: async () => (await api.post<{ revoked: number }>("/auth/me/sessions/revoke-others")).data,
};
