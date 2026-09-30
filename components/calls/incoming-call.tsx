"use client";

import { Phone, PhoneOff, Video } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import { Avatar } from "@/components/ui/avatar";
import type { CallSession } from "@/lib/call-state";
import { fullName } from "@/lib/utils";

type IncomingCallProps = {
  session: CallSession;
  onAccept: () => void;
  onDecline: () => void;
};

/**
 * The ringing card. Not modal: someone typing elsewhere keeps their work, and
 * the card takes focus only to be announced. Decline and Accept sit far apart
 * so a hurried tap on a phone doesn't hit the wrong one.
 */
export function IncomingCall({ session, onAccept, onDecline }: IncomingCallProps) {
  const titleId = useId();
  const ref = useRef<HTMLDivElement>(null);
  const video = session.type === "VIDEO";
  const answering = session.phase !== "RINGING";
  const label = video ? "Incoming video call" : "Incoming voice call";

  useEffect(() => {
    ref.current?.focus();
  }, []);

  return (
    <div
      ref={ref}
      role="alertdialog"
      aria-labelledby={titleId}
      aria-describedby={`${titleId}-name`}
      tabIndex={-1}
      className="fixed inset-x-3 bottom-3 z-[70] rounded-2xl border border-line bg-panel p-5 shadow-[var(--shadow-dialog)] focus:outline-none sm:inset-x-auto sm:top-20 sm:right-6 sm:bottom-auto sm:w-[22rem] motion-safe:animate-fade-up"
    >
      <div className="flex items-center gap-4">
        <span className="relative shrink-0">
          <span className="absolute inset-0 rounded-full bg-lime/30 motion-safe:animate-ping" aria-hidden="true" />
          <Avatar user={session.peer} size="lg" className="relative" />
        </span>
        <div className="min-w-0">
          <p id={titleId} className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-lime uppercase">
            {video ? <Video className="size-3.5" aria-hidden="true" /> : <Phone className="size-3.5" aria-hidden="true" />}
            {label}
          </p>
          <p id={`${titleId}-name`} className="truncate text-lg font-semibold text-ink">
            {fullName(session.peer)}
          </p>
          <p className="text-sm text-ink-mute" aria-live="polite">
            {answering ? "Connecting…" : "is calling you"}
          </p>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between gap-6">
        <button
          type="button"
          onClick={onDecline}
          disabled={answering}
          className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-danger font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <PhoneOff className="size-5" aria-hidden="true" />
          Decline
        </button>
        <button
          type="button"
          onClick={onAccept}
          disabled={answering}
          className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-lime font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50 [:root[data-theme=dark]_&]:text-void"
        >
          {video ? <Video className="size-5" aria-hidden="true" /> : <Phone className="size-5" aria-hidden="true" />}
          Accept
        </button>
      </div>
    </div>
  );
}
