"use client";

import { AlertTriangle, Fingerprint, KeyRound, ShieldCheck, Smartphone } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { RecoveryCodes, TotpQr } from "@/components/auth/recovery-codes";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, fieldA11y } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { OtpInput } from "@/components/ui/otp-input";
import { useEnableTwoFactor } from "@/hooks/use-two-factor";
import { describeError as friendlyError, isApiError } from "@/lib/api/client";
import { PasskeyCancelledError, passkeysSupported, provePasskey } from "@/lib/passkeys";
import { twoFactorService, type TwoFactorProof } from "@/services/two-factor.service";
import type { TwoFactorMethod, TwoFactorSetup, TwoFactorStatus } from "@/types/api";

const CODE_LENGTH = 6;

export function describeError(error: unknown): string {
  if (error instanceof PasskeyCancelledError) return "The passkey request was cancelled or timed out. Please try again.";
  if (!isApiError(error)) return error instanceof Error && error.message ? error.message : friendlyError(error).message;
  switch (error.code) {
    case "INVALID_TWO_FACTOR_CODE":
      return "Incorrect verification code. Check your authenticator app and try again.";
    case "INVALID_PASSWORD":
      return "Incorrect password.";
    case "PASSKEY_VERIFICATION_FAILED":
      return "That passkey could not be verified. Please try again.";
    case "PASSKEY_ALREADY_REGISTERED":
      return "This passkey is already registered to your account.";
    case "TWO_FACTOR_SETUP_REQUIRED":
      return "This setup has expired. Close this window and start again.";
    case "TWO_FACTOR_ALREADY_ENABLED":
      return "Your authenticator app is already set up.";
    case "TWO_FACTOR_NOT_ENABLED":
      return "Two-factor authentication is already off for your account.";
    default:
      return error.message;
  }
}

export function FormAlert({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div role="alert" className="flex items-start gap-3 rounded-lg border border-danger/30 bg-danger/10 px-3.5 py-3 text-sm text-danger">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      {message}
    </div>
  );
}

/**
 * Asks for the password before a change to how the user signs in. `onConfirm`
 * does the actual work; whatever it throws is shown in the dialog.
 */
export function PasswordDialog({
  title,
  description,
  confirmLabel,
  tone = "cyan",
  icon,
  onConfirm,
  onClose,
}: {
  title: string;
  description: ReactNode;
  confirmLabel: string;
  tone?: "cyan" | "danger";
  icon?: ReactNode;
  onConfirm: (password: string) => Promise<void>;
  onClose: () => void;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()} tone={tone} title={title} description={description}>
      <form
        noValidate
        className="space-y-5"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!password) {
            setError("Enter your password.");
            return;
          }
          setError(null);
          setBusy(true);
          try {
            await onConfirm(password);
          } catch (e) {
            setError(describeError(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        <FormAlert message={error} />
        <Field label="Password" htmlFor="confirm-password" required>
          <Input
            {...fieldA11y("confirm-password", undefined)}
            type="password"
            autoComplete="current-password"
            autoFocus
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>
        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" variant={tone === "danger" ? "danger" : "primary"} loading={busy} icon={icon}>
            {confirmLabel}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/** Recovery codes on their own, for when a passkey just turned 2FA on. */
export function RecoveryCodesDialog({ codes, title = "Save your recovery codes", onClose }: { codes: string[]; title?: string; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()} title={title}>
      <RecoveryCodes codes={codes} onDone={onClose} />
    </Dialog>
  );
}

/**
 * QR → code → (recovery codes). Closing before the code leaves the setup
 * pending: the same QR comes back here, or on the login page at next sign-in.
 */
export function TotpSetupDialog({ setup, onClose }: { setup: TwoFactorSetup; onClose: () => void }) {
  const enable = useEnableTwoFactor();
  const [code, setCode] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [finished, setFinished] = useState(false);

  const close = () => {
    if (!finished) toast.info("Setup saved for later", { description: "Finish it here any time, or scan the QR code on the login page at your next sign-in." });
    onClose();
  };

  const confirm = (value: string) => {
    if (enable.isPending) return;
    setError(null);
    enable.mutate(value, {
      onSuccess: ({ recoveryCodes }) => {
        setFinished(true);
        toast.success(recoveryCodes ? "Two-factor authentication has been enabled successfully." : "Authenticator app added");
        if (recoveryCodes) setCodes(recoveryCodes);
        else onClose();
      },
      onError: (e) => {
        setError(describeError(e));
        setCode("");
      },
    });
  };

  if (codes) return <RecoveryCodesDialog codes={codes} onClose={onClose} />;

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && close()}
      title="Set up your authenticator app"
      description="Add an extra layer of security to your TimeFlow account."
      className="max-h-[calc(100dvh-2rem)] overflow-y-auto"
    >
      <form
        noValidate
        className="space-y-6"
        onSubmit={(event) => {
          event.preventDefault();
          if (code.length === CODE_LENGTH) confirm(code);
          else setError("Enter the 6-digit code from your authenticator app.");
        }}
      >
        <section className="space-y-1">
          <h3 className="text-sm font-semibold text-ink">Step 1 · Install an authenticator app</h3>
          <p className="text-sm text-ink-dim">Google Authenticator, Microsoft Authenticator, or any other TOTP app or browser extension.</p>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-ink">Step 2 · Scan this QR code</h3>
          <TotpQr qrCodeDataUrl={setup.qrCodeDataUrl} secret={setup.secret} showKey={showKey} onShowKey={() => setShowKey(true)} />
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-ink">Step 3 · Enter the 6-digit code from your app</h3>
          <FormAlert message={error} />
          <OtpInput
            label="Code from your authenticator app"
            value={code}
            onChange={(value) => {
              setCode(value);
              if (error) setError(null);
            }}
            onComplete={confirm}
            disabled={enable.isPending}
            invalid={error !== null}
          />
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-ink-mute">Not now? You can finish on the login page next time you sign in.</p>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={close}>
              Later
            </Button>
            <Button type="submit" loading={enable.isPending} disabled={code.length !== CODE_LENGTH} icon={<ShieldCheck className="size-4" />}>
              Verify &amp; enable
            </Button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}

const PROOF_LABEL: Record<TwoFactorMethod, { label: string; icon: typeof KeyRound }> = {
  passkey: { label: "Passkey", icon: Fingerprint },
  totp: { label: "Authenticator code", icon: Smartphone },
  recovery: { label: "Recovery code", icon: KeyRound },
};

/**
 * Sensitive change guarded by the second factor (and, optionally, the
 * password): turning 2FA off, or new recovery codes. The user proves it with
 * whichever method they have.
 */
export function ProofDialog({
  status,
  title,
  description,
  confirmLabel,
  tone = "cyan",
  withPassword,
  onSubmit,
  onClose,
  children,
}: {
  status: TwoFactorStatus;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  tone?: "cyan" | "danger";
  withPassword?: boolean;
  onSubmit: (input: { password: string; proof: TwoFactorProof }) => Promise<void>;
  onClose: () => void;
  children?: ReactNode;
}) {
  const methods: TwoFactorMethod[] = [];
  if (status.passkeys.length > 0 && passkeysSupported()) methods.push("passkey");
  if (status.totp.enabled) methods.push("totp");
  methods.push("recovery");

  const [method, setMethod] = useState<TwoFactorMethod>(methods[0]!);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (withPassword && !password) {
      setError("Enter your password.");
      return;
    }
    if (method === "totp" && code.length !== CODE_LENGTH) {
      setError("Enter the 6-digit code from your authenticator app.");
      return;
    }
    if (method === "recovery" && !code.trim()) {
      setError("Enter one of your recovery codes.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const proof: TwoFactorProof =
        method === "passkey" ? { passkey: await provePasskey(await twoFactorService.stepUpOptions()) } : { code: code.trim() };
      await onSubmit({ password, proof });
    } catch (e) {
      setError(describeError(e));
      setCode("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()} tone={tone} title={title} description={description}>
      <form
        noValidate
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <FormAlert message={error} />
        {children}
        {withPassword && (
          <Field label="Password" htmlFor="proof-password" required>
            <Input
              {...fieldA11y("proof-password", undefined)}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </Field>
        )}

        {methods.length > 1 && (
          <div role="radiogroup" aria-label="Verify with" className="flex flex-wrap gap-2">
            {methods.map((m) => {
              const { label, icon: Icon } = PROOF_LABEL[m];
              return (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={method === m}
                  onClick={() => {
                    setMethod(m);
                    setCode("");
                    setError(null);
                  }}
                  className={
                    method === m
                      ? "flex items-center gap-1.5 rounded-lg border border-cyan bg-cyan/5 px-3 py-1.5 text-sm text-ink"
                      : "flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm text-ink-dim hover:bg-panel-2"
                  }
                >
                  <Icon className="size-3.5" aria-hidden="true" />
                  {label}
                </button>
              );
            })}
          </div>
        )}

        {method === "passkey" && (
          <p className="text-sm text-ink-dim">You&apos;ll be asked to confirm with Face ID, Touch ID, Windows Hello or your device PIN.</p>
        )}
        {method === "totp" && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-ink">Code from your authenticator app</p>
            <OtpInput label="Authenticator code" value={code} onChange={setCode} disabled={busy} invalid={error !== null} />
          </div>
        )}
        {method === "recovery" && (
          <Field label="Recovery code" htmlFor="proof-recovery">
            <Input
              {...fieldA11y("proof-recovery", undefined)}
              value={code}
              onChange={(event) => setCode(event.target.value)}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="xxxxx-xxxxx"
              className="font-mono"
            />
          </Field>
        )}

        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant={tone === "danger" ? "danger" : "primary"}
            loading={busy}
            icon={method === "passkey" ? <Fingerprint className="size-4" /> : undefined}
          >
            {confirmLabel}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
