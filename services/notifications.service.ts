import { api, request } from "@/lib/api/client";
import type { Notification } from "@/types/api";

export const notificationsService = {
  list: async (unreadOnly = false) => {
    const res = await request<Notification[]>("/notifications", { query: { unread: unreadOnly || undefined, limit: 15 } });
    return { items: res.data, unread: res.meta?.unread ?? res.data.filter((n) => !n.readAt).length };
  },
  markRead: async (id: string) => {
    await api.patch<Notification>(`/notifications/${id}/read`);
  },
  markAllRead: async () => {
    await api.post<null>("/notifications/read-all");
  },
};
