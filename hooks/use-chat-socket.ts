"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import type { Socket } from "socket.io-client";
import { acquireChatSocket, chatConnection, releaseChatSocket } from "@/lib/socket";
import type { ChatConnectionState } from "@/types/chat";

/**
 * The tab's shared chat socket (one connection however many components use
 * it) and its connection state. Pass `enabled: false` until there is a session.
 */
export function useChatSocket(enabled = true): { socket: Socket | null; state: ChatConnectionState } {
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (!enabled) return;
    setSocket(acquireChatSocket());
    return () => {
      releaseChatSocket();
      setSocket(null);
    };
  }, [enabled]);

  const state = useSyncExternalStore(chatConnection.subscribe, chatConnection.getState, () => "connecting" as const);
  return { socket, state };
}
