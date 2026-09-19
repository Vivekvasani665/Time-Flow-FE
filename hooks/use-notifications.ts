"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";
import { ensureFreshSession } from "@/lib/api/client";
import { queryKeys } from "@/lib/query-keys";
import { notificationsService } from "@/services/notifications.service";
import type { Notification } from "@/types/api";

export function useNotifications(enabled: boolean) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: queryKeys.notifications,
    queryFn: () => notificationsService.list(),
    refetchInterval: 30_000,
    enabled,
  });

  // Real-time push via SSE; polling above is the fallback if the stream drops.
  useEffect(() => {
    if (!enabled || typeof EventSource === "undefined") return;
    let source: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    const onNotification = (event: MessageEvent<string>) => {
      void qc.invalidateQueries({ queryKey: queryKeys.notifications });
      try {
        const n = JSON.parse(event.data) as Notification;
        toast(n.title, { description: n.body ?? undefined });
      } catch {
        /* malformed payload — the refetch still picks it up */
      }
    };

    const connect = async () => {
      await ensureFreshSession();
      if (cancelled) return;
      source = new EventSource("/api/notifications/stream", { withCredentials: true });
      source.addEventListener("notification", onNotification);
      source.onerror = () => {
        // Transient drops are retried by the browser; a non-200 response (e.g. a
        // lapsed session) closes the stream for good, so reconnect ourselves.
        if (source?.readyState !== EventSource.CLOSED) return;
        source.close();
        retryTimer = setTimeout(() => void connect(), 15_000);
      };
    };
    void connect();

    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
      source?.close();
    };
  }, [enabled, qc]);

  return query;
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationsService.markRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.notifications }),
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: notificationsService.markAllRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.notifications }),
  });
}
