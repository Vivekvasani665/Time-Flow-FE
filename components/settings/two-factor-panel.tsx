"use client";

import { Fingerprint, KeyRound, Plus, RefreshCw, ShieldCheck, ShieldOff, Smartphone, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import {
  useAddPasskey,
  useCancelTwoFactorSetup,
  useDisableTwoFactor,
  useRegenerateRecoveryCodes,
  useRemovePasskey,
  useRemoveTotp,
  useTwoFactorStatus,
} from "@/hooks/use-two-factor";
import { createPasskey, passkeysSupported } from "@/lib/passkeys";
import { notifyError } from "@/lib/notify";
import { formatDateTime } from "@/lib/utils";
import { twoFactorService } from "@/services/two-factor.service";
import type { Passkey, TwoFactorStatus } from "@/types/api";
import { TotpSetupInline } from "./totp-setup-inline";
import { PasswordDialog, ProofDialog, RecoveryCodesDialog } from "./two-factor-dialogs";

/** At or below this many unused recovery codes, nudge the user to make new ones. */
const LOW_RECOVERY_CODES = 3;

type DialogState =
  | { kind: "totp-remove" }
  | { kind: "passkey-add" }
  | { kind: "passkey-remove"; passkey: Passkey }
  | { kind: "codes"; codes: string[]; title?: string }
  | { kind: "regenerate" }
  | { kind: "disable" }
  | null;

function MethodRow({
  icon,
  title,
  badge,
  description,
  actions,
  children,
}: {
  icon: ReactNode;
  title: string;
  badge?: ReactNode;
  description: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="space-y-3 py-4 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-panel-3 text-ink-mute" aria-hidden="true">
            {icon}
          </span>
          <div className="min-w-0 space-y-0.5">
            <h3 className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
              {title}
              {badge}
            </h3>
            <p className="text-sm text-ink-dim">{description}</p>
          </div>
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

/**
 * Settings → Security. 2FA is on when there is at least one method: an
 * authenticator app and/or passkeys. Every change that adds or removes a way
 * to sign in asks for the password first.
 */
export function TwoFactorPanel() {
  const status = useTwoFactorStatus();
  const [dialog, setDialog] = useState<DialogState>(null);
  // The authenticator setup opens inside this panel, not in a pop-up.
  const [settingUpTotp, setSettingUpTotp] = useState(false);
  const data = status.data;

  return (
    <>
      <Panel title="Two-factor authentication" subtitle="Security" icon={<ShieldCheck />}>
        {status.isLoading ? (
          <Skeleton className="h-40" />
        ) : status.error ? (
          <ErrorState error={status.error} onRetry={() => status.refetch()} />
        ) : data ? (
          <Methods data={data} openDialog={setDialog} settingUpTotp={settingUpTotp} setSettingUpTotp={setSettingUpTotp} />
        ) : null}
      </Panel>

      {data && <Dialogs data={data} dialog={dialog} setDialog={setDialog} />}
    </>
  );
}

function Methods({
  data,
  openDialog,
  settingUpTotp,
  setSettingUpTotp,
}: {
  data: TwoFactorStatus;
  openDialog: (d: DialogState) => void;
  settingUpTotp: boolean;
  setSettingUpTotp: (open: boolean) => void;
}) {
  const cancelSetup = useCancelTwoFactorSetup();
  const supported = passkeysSupported();

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <p className="flex items-center gap-2 text-sm font-medium text-ink">
          Status
          {data.enabled ? <Badge tone="lime">On</Badge> : <Badge tone="amber">Off</Badge>}
        </p>
        <p className="max-w-2xl text-sm text-ink-dim">
          {data.enabled
            ? "Your account is protected. After your password, signing in asks for a passkey or a code from your authenticator app."
            : "Add an extra layer of security to protect your TimeFlow account, with an authenticator app or a passkey."}
        </p>
        {data.enabled && data.enabledAt && (
          <p className="text-xs text-ink-mute">
            Turned on <span className="tabular">{formatDateTime(data.enabledAt)}</span>
          </p>
        )}
      </div>

      <div className="divide-y divide-line rounded-lg border border-line px-4 py-4">
        <MethodRow
          icon={<Smartphone className="size-4" />}
          title="Authenticator app"
          badge={data.totp.enabled ? <Badge tone="lime">On</Badge> : data.totp.pending ? <Badge tone="amber">Setup pending</Badge> : undefined}
          description={
            data.totp.enabled
              ? "6-digit codes from Google Authenticator, Microsoft Authenticator or a similar app."
              : data.totp.pending
                ? "Finish by scanning the QR code — here, or on the login page at your next sign-in."
                : "Scan a QR code once; the app then makes a new 6-digit code every 30 seconds."
          }
          actions={
            // While the setup is open below, its own buttons are the only ones that matter.
            settingUpTotp ? undefined : data.totp.enabled ? (
              <Button size="sm" variant="ghost" icon={<Trash2 className="size-3.5" />} onClick={() => openDialog({ kind: "totp-remove" })}>
                Remove
              </Button>
            ) : data.totp.pending ? (
              <>
                <Button size="sm" onClick={() => setSettingUpTotp(true)}>
                  Continue setup
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  loading={cancelSetup.isPending}
                  onClick={() =>
                    cancelSetup.mutate(undefined, {
                      onSuccess: () => toast.success("Authenticator setup cancelled"),
                      onError: (e) => notifyError(e, { title: "Could not cancel setup" }),
                    })
                  }
                >
                  Cancel setup
                </Button>
              </>
            ) : (
              <Button size="sm" icon={<ShieldCheck className="size-3.5" />} onClick={() => setSettingUpTotp(true)}>
                {data.enabled ? "Set up" : "Enable 2FA"}
              </Button>
            )
          }
        >
          {settingUpTotp && <TotpSetupInline pending={data.totp.pending} onClose={() => setSettingUpTotp(false)} />}
        </MethodRow>

        <MethodRow
          icon={<Fingerprint className="size-4" />}
          title="Passkeys"
          badge={data.passkeys.length > 0 ? <Badge tone="lime">{data.passkeys.length}</Badge> : undefined}
          description={
            supported
              ? "Confirm it's you with Face ID, Touch ID, Windows Hello or your device PIN — no code, no QR."
              : "This browser does not support passkeys."
          }
          actions={
            supported ? (
              <Button size="sm" variant="secondary" icon={<Plus className="size-3.5" />} onClick={() => openDialog({ kind: "passkey-add" })}>
                Add a passkey
              </Button>
            ) : undefined
          }
        >
          {data.passkeys.length > 0 && (
            <ul aria-label="Passkeys" className="space-y-2 sm:pl-12">
              {data.passkeys.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-panel-2 px-3 py-2">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm text-ink">
                      {p.name}
                      {p.backedUp && <Badge tone="cyan">Synced</Badge>}
                    </p>
                    <p className="text-xs text-ink-mute">
                      Added <span className="tabular">{formatDateTime(p.createdAt)}</span>
                      {p.lastUsedAt && (
                        <>
                          {" · last used "}
                          <span className="tabular">{formatDateTime(p.lastUsedAt)}</span>
                        </>
                      )}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Remove ${p.name}`}
                    icon={<Trash2 className="size-3.5" />}
                    onClick={() => openDialog({ kind: "passkey-remove", passkey: p })}
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </MethodRow>

        {data.enabled && (
          <MethodRow
            icon={<KeyRound className="size-4" />}
            title="Recovery codes"
            description={
              <>
                <span className="tabular font-medium text-ink">{data.recoveryCodesRemaining}</span> {data.recoveryCodesRemaining === 1 ? "code" : "codes"} left.
                {data.recoveryCodesRemaining <= LOW_RECOVERY_CODES && <span className="text-amber"> Running low — generate new ones.</span>}
              </>
            }
            actions={
              <Button size="sm" variant="secondary" icon={<RefreshCw className="size-3.5" />} onClick={() => openDialog({ kind: "regenerate" })}>
                Regenerate
              </Button>
            }
          />
        )}
      </div>

      {data.enabled && (
        <Button variant="ghost" className="text-danger hover:text-danger" icon={<ShieldOff className="size-4" />} onClick={() => openDialog({ kind: "disable" })}>
          Disable 2FA
        </Button>
      )}
    </div>
  );
}

function Dialogs({ data, dialog, setDialog }: { data: TwoFactorStatus; dialog: DialogState; setDialog: (d: DialogState) => void }) {
  const removeTotp = useRemoveTotp();
  const addPasskey = useAddPasskey();
  const removePasskey = useRemovePasskey();
  const regenerate = useRegenerateRecoveryCodes();
  const disable = useDisableTwoFactor();
  const close = () => setDialog(null);

  if (!dialog) return null;
  switch (dialog.kind) {
    case "totp-remove":
      return (
        <PasswordDialog
          tone="danger"
          title="Remove your authenticator app?"
          description={
            data.passkeys.length > 0
              ? "You'll sign in with your passkey instead."
              : "It is your only second factor, so two-factor authentication will turn off and your recovery codes will stop working."
          }
          confirmLabel="Remove"
          icon={<Trash2 className="size-4" />}
          onClose={close}
          onConfirm={async (password) => {
            const { twoFactorEnabled } = await removeTotp.mutateAsync(password);
            toast.success(twoFactorEnabled ? "Authenticator app removed" : "Authenticator app removed. Two-factor authentication is off.");
            close();
          }}
        />
      );
    case "passkey-add":
      return (
        <PasswordDialog
          title="Add a passkey"
          description="Confirm your password, then follow your browser's prompt (Face ID, Touch ID, Windows Hello or device PIN)."
          confirmLabel="Continue"
          icon={<Fingerprint className="size-4" />}
          onClose={close}
          onConfirm={async (password) => {
            const options = await twoFactorService.passkeyOptions(password);
            const response = await createPasskey(options);
            const { passkey, recoveryCodes } = await addPasskey.mutateAsync({ response });
            toast.success("Passkey added", { description: passkey.name });
            if (recoveryCodes) setDialog({ kind: "codes", codes: recoveryCodes, title: "2FA is on — save your recovery codes" });
            else close();
          }}
        />
      );
    case "passkey-remove": {
      const last = data.passkeys.length === 1 && !data.totp.enabled;
      return (
        <PasswordDialog
          tone="danger"
          title={`Remove “${dialog.passkey.name}”?`}
          description={
            last
              ? "It is your only second factor, so two-factor authentication will turn off and your recovery codes will stop working."
              : "You won't be able to sign in with this passkey any more."
          }
          confirmLabel="Remove"
          icon={<Trash2 className="size-4" />}
          onClose={close}
          onConfirm={async (password) => {
            const { twoFactorEnabled } = await removePasskey.mutateAsync({ id: dialog.passkey.id, password });
            toast.success(twoFactorEnabled ? "Passkey removed" : "Passkey removed. Two-factor authentication is off.");
            close();
          }}
        />
      );
    }
    case "codes":
      return <RecoveryCodesDialog codes={dialog.codes} title={dialog.title} onClose={close} />;
    case "regenerate":
      return (
        <ProofDialog
          status={data}
          title="Regenerate recovery codes?"
          description="Your current recovery codes will stop working immediately."
          confirmLabel="Generate new codes"
          onClose={close}
          onSubmit={async ({ proof }) => {
            const { recoveryCodes } = await regenerate.mutateAsync(proof);
            toast.success("New recovery codes generated", { description: "Your old codes no longer work." });
            setDialog({ kind: "codes", codes: recoveryCodes, title: "Save your new recovery codes" });
          }}
        />
      );
    case "disable":
      return (
        <ProofDialog
          status={data}
          tone="danger"
          withPassword
          title="Disable two-factor authentication?"
          description="Signing in will only need your password. Your authenticator app, passkeys and recovery codes will all be removed."
          confirmLabel="Disable 2FA"
          onClose={close}
          onSubmit={async ({ password, proof }) => {
            await disable.mutateAsync({ password, ...proof });
            toast.success("Two-factor authentication disabled");
            close();
          }}
        />
      );
  }
}
