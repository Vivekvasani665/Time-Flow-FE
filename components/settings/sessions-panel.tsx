"use client";

import { LogOut, Monitor, Smartphone, Tablet } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Panel } from "@/components/ui/panel";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { useRevokeOtherSessions, useRevokeSession, useSessions } from "@/hooks/use-sessions";
import { cn, formatDateTime } from "@/lib/utils";
import type { Session } from "@/types/api";
import { notifyError } from "@/lib/notify";

/**
 * A readable device name from the user-agent. Deliberately coarse — this is a
 * "do I recognise this?" hint, not analytics.
 */
function describeDevice(ua: string | null): { label: string; icon: typeof Monitor } {
  if (!ua) return { label: "Unknown device", icon: Monitor };
  const browser =
    /Edg\//.test(ua) ? "Edge"
    : /OPR\/|Opera/.test(ua) ? "Opera"
    : /Chrome\//.test(ua) ? "Chrome"
    : /Safari\//.test(ua) ? "Safari"
    : /Firefox\//.test(ua) ? "Firefox"
    : "Browser";
  const os =
    /iPhone|iPad|iPod/.test(ua) ? "iOS"
    : /Android/.test(ua) ? "Android"
    : /Mac OS X|Macintosh/.test(ua) ? "macOS"
    : /Windows/.test(ua) ? "Windows"
    : /Linux/.test(ua) ? "Linux"
    : "Unknown OS";
  const icon = /iPad|Tablet/.test(ua) ? Tablet : /iPhone|iPod|Android|Mobile/.test(ua) ? Smartphone : Monitor;
  return { label: `${browser} on ${os}`, icon };
}

export function SessionsPanel() {
  const sessions = useSessions();
  const revoke = useRevokeSession();
  const revokeOthers = useRevokeOtherSessions();
  const [pending, setPending] = useState<Session | null>(null);

  const items = sessions.data ?? [];
  const others = items.filter((s) => !s.current).length;

  return (
    <>
      <Panel
        title="Signed-in devices"
        icon={<Monitor />}
        actions={
          others > 0 ? (
            <Button
              size="sm"
              variant="secondary"
              icon={<LogOut className="size-3.5" />}
              loading={revokeOthers.isPending}
              onClick={() =>
                revokeOthers.mutate(undefined, {
                  onSuccess: ({ revoked }) =>
                    toast.success(revoked === 1 ? "Signed out 1 other device" : `Signed out ${revoked} other devices`),
                  onError: (e) => notifyError(e, { title: "Could not sign out" }),
                })
              }
            >
              Sign out others
            </Button>
          ) : undefined
        }
      >
        {sessions.isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : sessions.error ? (
          <ErrorState error={sessions.error} onRetry={() => sessions.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState title="No active sessions" description="Sign in somewhere and it will show up here." />
        ) : (
          <ul className="-my-3 divide-y divide-line">
            {items.map((s) => {
              const { label, icon: Icon } = describeDevice(s.userAgent);
              return (
                <li key={s.familyId} className="flex items-center gap-3 py-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-panel-3">
                    <Icon className={cn("size-4", s.current ? "text-cyan" : "text-ink-mute")} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
                      {label}
                      {s.current && (
                        <Badge tone="lime">
                          This device
                        </Badge>
                      )}
                    </p>
                    <p className="text-xs text-ink-mute">
                      <span className="tabular">{s.ipAddress ?? "unknown IP"}</span>
                      {" · signed in "}
                      <span className="tabular">{formatDateTime(s.lastSeenAt)}</span>
                    </p>
                  </div>
                  {!s.current && (
                    <Button size="sm" variant="ghost" onClick={() => setPending(s)}>
                      Sign out
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-4 border-t border-line pt-4 text-xs text-ink-mute">
          Signing a device out stops it renewing its session. Its current access token keeps working for up to 15 minutes,
          after which it is locked out.
        </p>
      </Panel>

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        title="Sign out this device?"
        description={
          pending ? `${describeDevice(pending.userAgent).label} · ${pending.ipAddress ?? "unknown IP"} will have to sign in again.` : ""
        }
        confirmLabel="Sign out"
        loading={revoke.isPending}
        onConfirm={() => {
          if (!pending) return;
          revoke.mutate(pending.familyId, {
            onSuccess: () => {
              toast.success("Device signed out");
              setPending(null);
            },
            onError: (e) => notifyError(e, { title: "Could not sign out" }),
          });
        }}
      />
    </>
  );
}
