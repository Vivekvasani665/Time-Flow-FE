"use client";

import { Phone, PhoneIncoming, PhoneMissed, PhoneOff, PhoneOutgoing, Video } from "lucide-react";
import { formatCallDuration } from "@/lib/call-state";
import { cn } from "@/lib/utils";
import type { CallHistoryItem } from "@/types/call";
import { useCall } from "./call-provider";

const timeFmt = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });

/** "Missed voice call", "Video call · 12 min 18 sec", … from this viewer's side. */
export function describeCall(call: CallHistoryItem): { title: string; detail: string | null; missed: boolean } {
  const kind = call.type === "VIDEO" ? "video call" : "voice call";
  const Kind = call.type === "VIDEO" ? "Video call" : "Voice call";
  const outgoing = call.direction === "outgoing";
  switch (call.status) {
    case "MISSED":
      return outgoing ? { title: Kind, detail: "No answer", missed: false } : { title: `Missed ${kind}`, detail: null, missed: true };
    case "REJECTED":
      return { title: outgoing ? `${Kind} declined` : `You declined a ${kind}`, detail: null, missed: false };
    case "FAILED":
      return { title: `${Kind} couldn't connect`, detail: null, missed: false };
    default:
      return { title: Kind, detail: call.durationSeconds ? formatCallDuration(call.durationSeconds) : null, missed: false };
  }
}

/** A call in a conversation's timeline, centred like a system line, with a way to call back. */
export function CallHistoryEntry({ call }: { call: CallHistoryItem }) {
  const { available, session, startCall } = useCall();
  const { title, detail, missed } = describeCall(call);
  const peer = call.direction === "outgoing" ? call.receiver : call.caller;
  const Icon =
    call.status === "MISSED" && call.direction === "incoming"
      ? PhoneMissed
      : call.status === "REJECTED" || call.status === "FAILED"
        ? PhoneOff
        : call.type === "VIDEO"
          ? Video
          : call.direction === "outgoing"
            ? PhoneOutgoing
            : PhoneIncoming;

  return (
    <div className="my-2 flex justify-center px-4" data-testid="call-entry">
      <div className={cn("flex items-center gap-3 rounded-xl border px-3.5 py-2 text-sm", missed ? "border-danger/30 bg-danger/5" : "border-line bg-panel-2")}>
        <span
          className={cn("flex size-8 shrink-0 items-center justify-center rounded-full", missed ? "bg-danger/15 text-danger" : "bg-cyan/10 text-cyan")}
          aria-hidden="true"
        >
          <Icon className="size-4" />
        </span>
        <div className="min-w-0">
          <p className={cn("font-medium", missed ? "text-danger" : "text-ink")}>{title}</p>
          <p className="text-xs text-ink-mute">
            {detail ? `${detail} · ` : ""}
            <time dateTime={call.startedAt}>{timeFmt.format(new Date(call.startedAt))}</time>
          </p>
        </div>
        {available && (
          <button
            type="button"
            onClick={() => startCall(peer, call.type)}
            disabled={session !== null}
            className="ml-2 flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-cyan hover:bg-cyan/10 disabled:pointer-events-none disabled:opacity-40"
            aria-label={`Call ${peer.firstName} back (${call.type === "VIDEO" ? "video" : "voice"})`}
          >
            <Phone className="size-3.5" aria-hidden="true" /> Call back
          </button>
        )}
      </div>
    </div>
  );
}
