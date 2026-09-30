import { cn } from "@/lib/utils";
import type { ChatPresence } from "@/types/chat";

export const PRESENCE_LABEL: Record<ChatPresence, string> = { online: "Online", away: "Away", offline: "Offline" };

const STYLE: Record<ChatPresence, string> = {
  online: "bg-lime",
  away: "bg-amber",
  offline: "bg-panel border-[1.5px] border-ink-mute",
};

/**
 * Status dot for an avatar's corner. Colour is never the only signal: the dot
 * carries the label for screen readers, unless `decorative` because the same
 * words are already shown beside it.
 */
export function PresenceDot({ presence, className, decorative }: { presence: ChatPresence; className?: string; decorative?: boolean }) {
  return (
    <span
      className={cn("block size-2.5 rounded-full ring-2 ring-panel", STYLE[presence], className)}
      title={PRESENCE_LABEL[presence]}
      aria-hidden={decorative || undefined}
    >
      {!decorative && <span className="sr-only">{PRESENCE_LABEL[presence]}</span>}
    </span>
  );
}
