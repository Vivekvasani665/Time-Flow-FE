"use client";

import { Phone, Video } from "lucide-react";
import { chatIconButton } from "@/components/chat/chat-reaction-picker";
import { isLive } from "@/lib/call-state";
import { cn } from "@/lib/utils";
import type { ChatUser } from "@/types/chat";
import { useCall } from "./call-provider";

/**
 * Voice and video call buttons for a conversation header or a list row.
 * Hidden where calls aren't available; `disabledReason` shows them greyed out
 * with that explanation (e.g. a sample contact who can't be called).
 */
export function CallButtons({ peer, disabledReason, className }: { peer: ChatUser; disabledReason?: string; className?: string }) {
  const { available, session, startCall } = useCall();
  if (!available) return null;
  const why = disabledReason ?? (isLive(session) ? "You're already on a call" : undefined);
  const busy = why !== undefined;
  return (
    <>
      <button
        type="button"
        onClick={() => startCall(peer, "VOICE")}
        disabled={busy}
        className={cn(chatIconButton, "disabled:cursor-not-allowed disabled:opacity-40", className)}
        aria-label={`Start a voice call with ${peer.firstName}`}
        title={why ?? "Voice call"}
      >
        <Phone className="size-4" />
      </button>
      <button
        type="button"
        onClick={() => startCall(peer, "VIDEO")}
        disabled={busy}
        className={cn(chatIconButton, "disabled:cursor-not-allowed disabled:opacity-40", className)}
        aria-label={`Start a video call with ${peer.firstName}`}
        title={why ?? "Video call"}
      >
        <Video className="size-4" />
      </button>
    </>
  );
}
