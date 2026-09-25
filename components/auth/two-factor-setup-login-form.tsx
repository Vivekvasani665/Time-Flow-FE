"use client";

import { AlertTriangle, ArrowLeft, ArrowRight, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { OtpInput } from "@/components/ui/otp-input";
import { isApiError } from "@/lib/api/client";
import { authService, type TwoFactorSetupChallenge } from "@/services/auth.service";
import type { AuthUser } from "@/types/api";
import { RecoveryCodes, TotpQr } from "./recovery-codes";
import { ChallengeExpired, DEAD_CHALLENGE, describeTwoFactorError } from "./two-factor-login-form";

const CODE_LENGTH = 6;

/**
 * The user started setting up an authenticator app in Settings but never
 * confirmed it, so this sign-in finishes the job: scan the QR (the same one
 * Settings showed — it is not regenerated), enter a code, save the recovery
 * codes, then on to the dashboard.
 */
export function TwoFactorSetupLoginForm({
  challenge,
  onSuccess,
  onCancel,
}: {
  challenge: TwoFactorSetupChallenge;
  onSuccess: (user: AuthUser) => void;
  onCancel: () => void;
}) {
  const [code, setCode] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deadReason, setDeadReason] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  // Signed in and 2FA on; held back until the codes are saved.
  const [done, setDone] = useState<{ user: AuthUser; recoveryCodes: string[] } | null>(null);

  const verify = async (value: string) => {
    if (verifying) return;
    setFormError(null);
    setVerifying(true);
    try {
      setDone(await authService.completeTwoFactorSetup({ challengeToken: challenge.challengeToken, code: value }));
    } catch (error) {
      if (isApiError(error) && error.code in DEAD_CHALLENGE) setDeadReason(DEAD_CHALLENGE[error.code]!);
      else setFormError(describeTwoFactorError(error, "totp"));
      setCode("");
    } finally {
      setVerifying(false);
    }
  };

  if (deadReason) return <ChallengeExpired reason={deadReason} onBack={onCancel} />;

  if (done) {
    return (
      <div className="space-y-4">
        <p role="status" className="flex items-center gap-2 rounded-lg border border-lime/30 bg-lime/10 px-3.5 py-3 text-sm text-ink">
          <ShieldCheck className="size-4 shrink-0 text-lime" aria-hidden="true" />
          Two-factor authentication has been enabled successfully.
        </p>
        <RecoveryCodes
          codes={done.recoveryCodes}
          onDone={() => onSuccess(done.user)}
          doneLabel="Continue to dashboard"
          doneIcon={<ArrowRight className="size-4" />}
        />
      </div>
    );
  }

  return (
    <form
      noValidate
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        if (code.length === CODE_LENGTH) void verify(code);
        else setFormError("Enter the 6-digit code from your authenticator app.");
      }}
    >
      <section className="space-y-1">
        <h2 className="text-sm font-semibold text-ink">Step 1 · Install an authenticator app</h2>
        <p className="text-sm text-ink-dim">Google Authenticator, Microsoft Authenticator, or any other TOTP app or browser extension.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-ink">Step 2 · Scan this QR code</h2>
        <TotpQr qrCodeDataUrl={challenge.setup.qrCodeDataUrl} secret={challenge.setup.secret} showKey={showKey} onShowKey={() => setShowKey(true)} />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-ink">Step 3 · Enter the 6-digit code from your app</h2>
        {formError && (
          <div role="alert" className="flex items-start gap-3 rounded-lg border border-danger/30 bg-danger/10 px-3.5 py-3 text-sm text-danger">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {formError}
          </div>
        )}
        <OtpInput
          label="Code from your authenticator app"
          value={code}
          onChange={(value) => {
            setCode(value);
            if (formError) setFormError(null);
          }}
          onComplete={(value) => void verify(value)}
          disabled={verifying}
          invalid={formError !== null}
        />
      </section>

      <Button type="submit" size="lg" className="h-12 w-full rounded-xl text-base" loading={verifying} disabled={code.length !== CODE_LENGTH} icon={verifying ? undefined : <ShieldCheck className="size-4" aria-hidden="true" />}>
        {verifying ? "Verifying…" : "Verify & enable"}
      </Button>

      <div className="border-t border-line pt-5">
        <Button variant="ghost" onClick={onCancel} icon={<ArrowLeft className="size-4" aria-hidden="true" />}>
          Back to login
        </Button>
      </div>
    </form>
  );
}
