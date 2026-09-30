"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { queryKeys } from "@/lib/query-keys";
import { callService } from "@/services/call.service";
import type { CallContact, CallHistoryItem } from "@/types/call";
import type { ChatUser } from "@/types/chat";
import { useChatSocket } from "./use-chat-socket";

/**
 * Real team members you can call, with live presence: loaded once, then kept
 * current by the chat socket's online/offline events.
 */
export function useCallContacts() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { socket } = useChatSocket(Boolean(user));
  const query = useQuery({ queryKey: queryKeys.calls.contacts, queryFn: callService.contacts, enabled: Boolean(user), staleTime: 60_000 });

  useEffect(() => {
    if (!socket) return;
    const set = (userId: string, online: boolean) =>
      queryClient.setQueryData<CallContact[]>(queryKeys.calls.contacts, (prev) => prev?.map((c) => (c.id === userId ? { ...c, online } : c)));
    const onOnline = ({ user: who }: { user: ChatUser }) => set(who.id, true);
    const onOffline = ({ userId }: { userId: string }) => set(userId, false);
    socket.on("chat:user:online", onOnline);
    socket.on("chat:user:offline", onOffline);
    return () => {
      socket.off("chat:user:online", onOnline);
      socket.off("chat:user:offline", onOffline);
    };
  }, [socket, queryClient]);

  return query.data ?? [];
}

/** Calls between you and one person, for their conversation. */
export function useCallHistory(userId: string | null) {
  return useQuery<CallHistoryItem[]>({
    queryKey: queryKeys.calls.history(userId ?? ""),
    queryFn: () => callService.history(userId!),
    enabled: Boolean(userId),
    staleTime: 30_000,
  }).data;
}
