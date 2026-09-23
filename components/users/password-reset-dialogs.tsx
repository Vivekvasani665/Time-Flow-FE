"use client";

import type { ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog } from "@/components/ui/dialog";
import { PasswordResetStatusBadge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { usePasswordResetStatus, useSendPasswordReset } from "@/hooks/use-password-resets";
import { isApiError } from "@/lib/api/client";
import { formatDateTime, fullName } from "@/lib/utils";
import type { PasswordResetRequest, PasswordResetStatus } from "@/types/api";

type Member = { id: string; firstName: string; lastName: string; email: string };

/** One line under the status explaining what it means for the admin. */
const STATUS_HINT: Record<PasswordResetStatus, string> = {
  PENDING: "Password reset link sent. Waiting for the member to reset their password.",
  COMPLETED: "The member has chosen a new password.",
  EXPIRED: "The link expired before it was used. Send a new one if the member still needs it.",
  CANCELLED: "This link was replaced or could not be delivered.",
};

export function SendPasswordResetDialog({
  member,
  resend,
  onOpenChange,
}: {
  member: Member | null;
  /** A link is already pending; sending again replaces it. */
  resend?: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const send = useSendPasswordReset();

  const confirm = async () => {
    if (!member) return;
    try {
      await send.mutateAsync(member.id);
      toast.success("Password reset link sent successfully.", { description: `Sent to ${member.email}.` });
      onOpenChange(false);
    } catch (error) {
      toast.error("Unable to send password reset email.", { description: isApiError(error) ? error.message : "Try again." });
    }
  };

  return (
    <ConfirmDialog
      open={member !== null}
      onOpenChange={onOpenChange}
      title={resend ? "Resend Password Reset" : "Send Password Reset"}
      description={
        member && (
          <span className="block space-y-3">
            <span className="block">Are you sure you want to send a password reset link to:</span>
            <span className="block rounded-lg border border-line bg-panel-2 px-3.5 py-2.5">
              <span className="block font-medium text-ink">{fullName(member)}</span>
              <span className="block text-ink-mute">{member.email}</span>
            </span>
            <span className="block">
              The member will receive a password reset link by email.
              {resend && " The link sent earlier will stop working."}
            </span>
          </span>
        )
      }
      confirmLabel={send.isPending ? "Sending…" : "Send Reset Link"}
      destructive={false}
      loading={send.isPending}
      onConfirm={() => void confirm()}
    />
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[7rem_1fr] items-baseline gap-3 py-2.5 text-sm">
      <dt className="text-ink-mute">{label}</dt>
      <dd className="min-w-0 break-words text-ink">{children}</dd>
    </div>
  );
}

/** Status and times only — the API never returns the token or the password, and neither does this. */
export function PasswordResetDetailsDialog({
  member,
  onOpenChange,
  onResend,
}: {
  member: Member | null;
  onOpenChange: (open: boolean) => void;
  onResend: (member: Member, current: PasswordResetRequest | null) => void;
}) {
  const status = usePasswordResetStatus(member?.id ?? null);
  const reset = status.data ?? null;

  return (
    <Dialog
      open={member !== null}
      onOpenChange={onOpenChange}
      title="Password Reset Details"
      footer={
        member && (
          <>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button onClick={() => onResend(member, reset)} disabled={status.isLoading}>
              {reset?.status === "PENDING" ? "Resend link" : "Send new link"}
            </Button>
          </>
        )
      }
    >
      {member && (
        <dl className="divide-y divide-line">
          <Detail label="Member">{fullName(member)}</Detail>
          <Detail label="Email">{member.email}</Detail>
          {status.isLoading ? (
            <div className="flex items-center gap-2 py-4 text-sm text-ink-mute">
              <Spinner /> Loading status…
            </div>
          ) : status.isError ? (
            <p role="alert" className="py-4 text-sm text-danger">
              {isApiError(status.error) ? status.error.message : "Could not load the reset status."}
            </p>
          ) : !reset ? (
            <Detail label="Status">No password reset has been requested.</Detail>
          ) : (
            <>
              <Detail label="Status">
                <PasswordResetStatusBadge status={reset.status} />
                <span className="mt-1.5 block text-xs text-ink-mute">{STATUS_HINT[reset.status]}</span>
              </Detail>
              <Detail label="Requested">
                {formatDateTime(reset.createdAt)}
                {reset.requestedBy && <span className="block text-xs text-ink-mute">by {fullName(reset.requestedBy)}</span>}
              </Detail>
              {reset.status === "PENDING" || reset.status === "EXPIRED" ? (
                <Detail label={reset.status === "EXPIRED" ? "Expired" : "Expires"}>{formatDateTime(reset.expiresAt)}</Detail>
              ) : null}
              {reset.status === "COMPLETED" && <Detail label="Completed">{formatDateTime(reset.completedAt)}</Detail>}
              {reset.status === "CANCELLED" && <Detail label="Cancelled">{formatDateTime(reset.cancelledAt)}</Detail>}
            </>
          )}
        </dl>
      )}
    </Dialog>
  );
}
