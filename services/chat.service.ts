import { api, request } from "@/lib/api/client";
import type { ChatMessage, ChatPage, ChatReactionUpdate, ChatUnread, ChatUser } from "@/types/chat";

type CursorMeta = { hasMore?: boolean; nextCursor?: string | null };

/**
 * REST side of chat. Live traffic goes over the socket (lib/socket.ts); these
 * are for loading history, and the fallback for sending while it is down.
 */
export const chatService = {
  /** Newest first, as the API returns them. */
  list: async (params: { before?: string; limit?: number } = {}, signal?: AbortSignal): Promise<ChatPage> => {
    const res = await request<ChatMessage[]>("/chat/messages", { query: params, signal });
    const meta = (res.meta ?? {}) as CursorMeta;
    return { items: res.data, hasMore: meta.hasMore ?? false, nextCursor: meta.nextCursor ?? null };
  },
  send: async (body: { content: string; replyToId?: string | null; clientId?: string }) =>
    (await api.post<ChatMessage>("/chat/messages", body)).data,
  edit: async (id: string, content: string) => (await api.patch<ChatMessage>(`/chat/messages/${id}`, { content })).data,
  remove: async (id: string) => (await api.delete<ChatMessage>(`/chat/messages/${id}`)).data,
  addReaction: async (id: string, emoji: string) =>
    (await api.post<ChatReactionUpdate>(`/chat/messages/${id}/reactions`, { emoji })).data,
  removeReaction: async (id: string, emoji: string) =>
    (await api.delete<ChatReactionUpdate>(`/chat/messages/${id}/reactions/${encodeURIComponent(emoji)}`)).data,
  unread: () => api.get<ChatUnread>("/chat/unread"),
  markRead: async () => (await api.post<{ lastReadAt: string }>("/chat/read")).data,
  online: () => api.get<ChatUser[]>("/chat/online"),
};
