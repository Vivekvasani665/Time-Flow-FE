"use client";

import { AlertTriangle, ArrowLeft, ArrowRight, Clock, Fingerprint, KeyRound, Smartphone } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, fieldA11y } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { OtpInput } from "@/components/ui/otp-input";
import { describeError as friendlyError, isApiError } from "@/lib/api/client";
import { PasskeyCancelledError, passkeysSupported, provePasskey } from "@/lib/passkeys";
import { authService, type TwoFactorChallenge } from "@/services/auth.service";
import type { AuthUser, TwoFactorMethod } from "@/types/api";

const CODE_LENGTH = 6;

/** A problem with this sign-in attempt itself: no code can fix it, only signing in again. */
export const DEAD_CHALLENGE: Record<string, string> = {
  TWO_FACTOR_CHALLENGE_EXPIRED: "Your verification session has expired. Please sign in again.",
  TWO_FACTOR_CHALLENGE_INVALID: "This sign-in attempt is no longer valid. Please sign in again.",
};

export function describeTwoFactorError(error: unknown, method: TwoFactorMethod): string {
  if (error instanceof PasskeyCancelledError) return "The passkey request was cancelled or timed out. Try again, or use another method.";
  if (!isApiError(error)) return error instanceof Error && error.message ? error.message : friendlyError(error).message;
  switch (error.code) {
    case "INVALID_TWO_FACTOR_CODE":
      return method === "recovery"
        ? "That recovery code is not valid or has already been used."
        : "Incorrect verification code. Check your authenticator app and try again.";
    case "PASSKEY_VERIFICATION_FAILED":
      return "That passkey could not be verified. Try again, or use another method.";
    case "PASSKEY_CHALLENGE_EXPIRED":
      return "The passkey request timed out. Please try again.";
    // The API says how long to wait.
    case "RATE_LIMITED":
      return error.message || "Too many attempts. Wait a few minutes and try again.";
    case "ACCOUNT_INACTIVE":
      return "This account is deactivated. Contact an administrator.";
    case "VALIDATION_ERROR":
      return method === "recovery" ? "Enter one of your recovery codes." : "Enter the 6-digit code from your authenticator app.";
    default:
      return error.message;
  }
}

/** Signing in again is the only way forward. */
export function ChallengeExpired({ reason, onBack }: { reason: string; onBack: () => void }) {
  return (
    <div className="space-y-5">
      <div role="alert" className="flex items-start gap-3 rounded-lg border border-amber/30 bg-amber/10 px-3.5 py-3 text-sm text-ink">
        <Clock className="mt-0.5 size-4 shrink-0 text-amber" aria-hidden="true" />
        {reason}
      </div>
      <Button size="lg" className="h-12 w-full rounded-xl text-base" onClick={onBack} icon={<ArrowLeft className="size-4" aria-hidden="true" />}>
        Back to login
      </Button>
    </div>
  );
}

const SWITCH_LABEL: Record<TwoFactorMethod, { label: string; icon: typeof KeyRound }> = {
  passkey: { label: "Use a passkey", icon: Fingerprint },
  totp: { label: "Use your authenticator app", icon: Smartphone },
  recovery: { label: "Use a recovery code", icon: KeyRound },
};

/**
 * Step two for an account with 2FA. The password was right, but no session
 * exists until a second factor comes back with the challenge: a passkey, a
 * code from the authenticator app, or a recovery code. Nothing is ever sent to
 * the user, so there is nothing to resend.
 */
export function TwoFactorLoginForm({
  challenge,
  onSuccess,
  onCancel,
}: {
  challenge: TwoFactorChallenge;
  onSuccess: (user: AuthUser) => void;
  onCancel: () => void;
}) {
  const offered = challenge.methods ?? ["totp", "recovery"];
  // A passkey needs browser support; without it, fall back to what the user can still use.
  // Passkey first (one tap), then the authenticator app; a recovery code is always the fallback.
  const available = (["passkey", "totp", "recovery"] as const).filter(
    (m) => m === "recovery" || (offered.includes(m) && (m !== "passkey" || passkeysSupported())),
  );

  const [method, setMethod] = useState<TwoFactorMethod>(available[0] ?? "recovery");
  const [code, setCode] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [deadReason, setDeadReason] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const recoveryRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (method === "recovery") recoveryRef.current?.focus();
  }, [method]);

  const fail = (error: unknown) => {
    if (isApiError(error) && error.code in DEAD_CHALLENGE) setDeadReason(DEAD_CHALLENGE[error.code]!);
    else setFormError(describeTwoFactorError(error, method));
  };

  const verifyCode = async (value: string) => {
    if (verifying || deadReason) return;
    setFormError(null);
    setVerifying(true);
    try {
      const { user, recoveryCodesRemaining } = await authService.verifyTwoFactorLogin({ challengeToken: challenge.challengeToken, code: value });
      if (recoveryCodesRemaining !== undefined) {
        toast.warning("Recovery code used", {
          description:
            recoveryCodesRemaining === 0
              ? "You have no recovery codes left. Generate new ones in Settings."
              : `${recoveryCodesRemaining} recovery ${recoveryCodesRemaining === 1 ? "code" : "codes"} left. You can generate new ones in Settings.`,
        });
      }
      onSuccess(user);
    } catch (error) {
      fail(error);
      setCode("");
    } finally {
      setVerifying(false);
    }
  };

  const verifyPasskey = async () => {
    if (verifying || deadReason) return;
    setFormError(null);
    setVerifying(true);
    try {
      const options = await authService.passkeyLoginOptions(challenge.challengeToken);
      const response = await provePasskey(options);
      onSuccess(await authService.loginWithPasskey({ challengeToken: challenge.challengeToken, response }));
    } catch (error) {
      fail(error);
    } finally {
      setVerifying(false);
    }
  };

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (method === "passkey") {
      void verifyPasskey();
    } else if (method === "totp") {
      if (code.length === CODE_LENGTH) void verifyCode(code);
      else setFormError("Enter the 6-digit code from your authenticator app.");
    } else {
      const value = recoveryCode.trim();
      if (value) void verifyCode(value);
      else setFormError("Enter one of your recovery codes.");
    }
  };

  const switchMethod = (next: TwoFactorMethod) => {
    setMethod(next);
    setFormError(null);
    setCode("");
    setRecoveryCode("");
  };

  if (deadReason) return <ChallengeExpired reason={deadReason} onBack={onCancel} />;

  const canSubmit = method === "passkey" || (method === "totp" ? code.length === CODE_LENGTH : recoveryCode.trim().length > 0);
  const others = available.filter((m) => m !== method);

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {formError && (
        <div role="alert" className="flex items-start gap-3 rounded-lg border border-danger/30 bg-danger/10 px-3.5 py-3 text-sm text-danger">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {formError}
        </div>
      )}

      {method === "passkey" && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-line bg-panel-2 px-4 py-6 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-cyan/10 text-cyan" aria-hidden="true">
            <Fingerprint className="size-7" />
          </span>
          <p className="text-sm text-ink-dim">Use Face ID, Touch ID, Windows Hello or your device PIN to confirm it&apos;s you.</p>
        </div>
      )}

      {method === "totp" && (
        <div className="space-y-3">
          <label htmlFor="totp" className="text-sm font-medium text-ink">
            Verification code
          </label>
          <OtpInput
            id="totp"
            value={code}
            onChange={(value) => {
              setCode(value);
              if (formError) setFormError(null);
            }}
            onComplete={(value) => void verifyCode(value)}
            disabled={verifying}
            invalid={formError !== null}
            autoFocus
          />
          <p className="flex items-center gap-2 text-xs text-ink-mute">
            <Smartphone className="size-3.5 shrink-0" aria-hidden="true" />
            Open your authenticator app to view your current code. It changes every 30 seconds.
          </p>
        </div>
      )}

      {method === "recovery" && (
        <Field label="Recovery code" htmlFor="recovery-code" hint="One of the codes you saved when you turned on two-factor authentication. Each works once.">
          <Input
            {...fieldA11y("recovery-code", undefined)}
            ref={recoveryRef}
            value={recoveryCode}
            onChange={(event) => setRecoveryCode(event.target.value)}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="xxxxx-xxxxx"
            disabled={verifying}
            className="h-12 rounded-xl text-center font-mono text-lg tracking-widest"
          />
        </Field>
      )}

      <Button
        type="submit"
        size="lg"
        className="h-12 w-full rounded-xl text-base"
        loading={verifying}
        disabled={!canSubmit}
        icon={method === "passkey" && !verifying ? <Fingerprint className="size-4" aria-hidden="true" /> : undefined}
      >
        {verifying ? "Verifying…" : method === "passkey" ? "Use passkey" : "Verify code"}
        {!verifying && method !== "passkey" && <ArrowRight className="size-4" aria-hidden="true" />}
      </Button>

      <div className="flex flex-col gap-2 border-t border-line pt-5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap">
          {others.map((m) => {
            const { label, icon: Icon } = SWITCH_LABEL[m];
            return (
              <Button key={m} variant="ghost" onClick={() => switchMethod(m)} icon={<Icon className="size-4" aria-hidden="true" />}>
                {label}
              </Button>
            );
          })}
        </div>
        <Button variant="ghost" onClick={onCancel} icon={<ArrowLeft className="size-4" aria-hidden="true" />}>
          Back to login
        </Button>
      </div>
    </form>
  );
}
