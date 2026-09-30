"use client";

import { Phone, Video } from "lucide-react";
import { chatIconButton } from "@/components/chat/chat-reaction-picker";
import { isLive } from "@/lib/call-state";
import { cn } from "@/lib/utils";
import type { ChatUser } from "@/types/chat";
import { useCall } from "./call-provider";

/** Voice and video call buttons for a conversation header. Hidden where calls aren't available. */
export function CallButtons({ peer }: { peer: ChatUser }) {
  const { available, session, startCall } = useCall();
  if (!available) return null;
  const busy = isLive(session);
  const why = busy ? "You're already on a call" : undefined;
  return (
    <>
      <button
        type="button"
        onClick={() => startCall(peer, "VOICE")}
        disabled={busy}
        className={cn(chatIconButton, "disabled:pointer-events-none disabled:opacity-40")}
        aria-label={`Start a voice call with ${peer.firstName}`}
        title={why ?? "Voice call"}
      >
        <Phone className="size-4" />
      </button>
      <button
        type="button"
        onClick={() => startCall(peer, "VIDEO")}
        disabled={busy}
        className={cn(chatIconButton, "disabled:pointer-events-none disabled:opacity-40")}
        aria-label={`Start a video call with ${peer.firstName}`}
        title={why ?? "Video call"}
      >
        <Video className="size-4" />
      </button>
    </>
  );
}
