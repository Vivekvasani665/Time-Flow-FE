"use client";

import { Check, CircleCheck, Clock, Copy, UserPlus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { RankBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Panel } from "@/components/ui/panel";
import { formatDateTime } from "@/lib/utils";
import type { CreatedInvitation } from "@/types/api";

const COPIED_MS = 2000;

function hoursLeft(expiresAt: string) {
  const hours = Math.round((Date.parse(expiresAt) - Date.now()) / 3_600_000);
  return hours >= 1 ? `${hours} hour${hours === 1 ? "" : "s"}` : "less than an hour";
}

export function InvitationLinkCard({ result, onInviteAnother }: { result: CreatedInvitation; onInviteAnother: () => void }) {
  const { invitation, inviteUrl } = result;
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      toast.success("Invitation link copied successfully.");
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), COPIED_MS);
    } catch {
      // Clipboard access can be blocked (insecure origin, denied permission): leave the link selected to copy by hand.
      inputRef.current?.select();
      toast.error("Could not copy automatically", { description: "The link is selected — press Ctrl+C / ⌘C to copy it." });
    }
  };

  return (
    <Panel>
      <div className="flex flex-col items-center text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-lime/10 text-lime" aria-hidden="true">
          <CircleCheck className="size-7" />
        </span>
        <h2 className="mt-4 text-xl font-semibold tracking-tight text-ink">Invitation Link Generated</h2>
        <p className="mt-1.5 max-w-md text-sm text-ink-mute">
          The invitation link has been generated successfully. Share this link with <strong className="text-ink">{invitation.email}</strong>.
        </p>
      </div>

      <div className="mt-6 space-y-1.5">
        <label htmlFor="invite-url" className="text-sm font-medium text-ink">
          Invitation Link
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input ref={inputRef} id="invite-url" value={inviteUrl} readOnly onFocus={(e) => e.currentTarget.select()} className="min-w-0 flex-1 font-mono text-xs" />
          <Button variant={copied ? "secondary" : "primary"} onClick={() => void copy()} icon={copied ? <Check className="size-4" /> : <Copy className="size-4" />} aria-live="polite">
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      </div>

      <dl className="mt-5 grid gap-3 rounded-xl border border-line bg-panel-2 px-4 py-3.5 text-sm sm:grid-cols-2">
        <div className="flex items-center justify-between gap-3 sm:block">
          <dt className="text-ink-mute">Role</dt>
          <dd className="sm:mt-1">
            <RankBadge roleName={invitation.role.name} />
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3 sm:block">
          <dt className="flex items-center gap-1.5 text-ink-mute">
            <Clock className="size-3.5" aria-hidden="true" /> Expires in {hoursLeft(invitation.expiresAt)}
          </dt>
          <dd className="tabular text-ink sm:mt-1">{formatDateTime(invitation.expiresAt)}</dd>
        </div>
      </dl>

      <p className="mt-4 text-xs text-ink-mute">
        The link works once. It stops working after the user sets a password, when it expires, or if you generate a new link for the same email.
      </p>

      <div className="mt-6 flex justify-end border-t border-line pt-5">
        <Button variant="secondary" onClick={onInviteAnother} icon={<UserPlus className="size-4" />}>
          Invite another user
        </Button>
      </div>
    </Panel>
  );
}
