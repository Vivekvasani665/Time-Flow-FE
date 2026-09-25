"use client";

import { ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { RecoveryCodes, TotpQr } from "@/components/auth/recovery-codes";
import { Button } from "@/components/ui/button";
import { Field, fieldA11y } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { OtpInput } from "@/components/ui/otp-input";
import { useEnableTwoFactor, useTwoFactorSetup } from "@/hooks/use-two-factor";
import type { TwoFactorSetup } from "@/types/api";
import { describeError, FormAlert } from "./two-factor-dialogs";

const CODE_LENGTH = 6;

type Step = { kind: "password" } | { kind: "scan"; setup: TwoFactorSetup } | { kind: "codes"; codes: string[] };

/**
 * Authenticator setup shown right inside the Settings panel — password, QR
 * code, 6-digit code, recovery codes — with no pop-up. Leaving before the code
 * keeps the setup pending: the same QR comes back here, or on the login page.
 */
export function TotpSetupInline({ pending, onClose }: { pending: boolean; onClose: () => void }) {
  const setup = useTwoFactorSetup();
  const enable = useEnableTwoFactor();
  const [step, setStep] = useState<Step>({ kind: "password" });
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const container = useRef<HTMLDivElement>(null);

  // Each step can be taller than the screen; keep its start in view.
  useEffect(() => {
    container.current?.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
  }, [step.kind]);

  const later = () => {
    if (step.kind === "scan") {
      toast.info("Setup saved for later", { description: "Finish it here any time, or scan the QR code on the login page at your next sign-in." });
    }
    onClose();
  };

  const confirm = (value: string) => {
    if (enable.isPending) return;
    setError(null);
    enable.mutate(value, {
      onSuccess: ({ recoveryCodes }) => {
        toast.success(recoveryCodes ? "Two-factor authentication has been enabled successfully." : "Authenticator app added");
        if (recoveryCodes) setStep({ kind: "codes", codes: recoveryCodes });
        else onClose();
      },
      onError: (e) => {
        setError(describeError(e));
        setCode("");
      },
    });
  };

  return (
    <div ref={container} className="space-y-5 rounded-lg border border-line bg-panel-2 p-4 sm:ml-12">
      {step.kind === "password" && (
        <form
          noValidate
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!password) {
              setError("Enter your password.");
              return;
            }
            setError(null);
            setup.mutate(password, {
              onSuccess: (data) => setStep({ kind: "scan", setup: data }),
              onError: (e) => setError(describeError(e)),
            });
          }}
        >
          <p className="text-sm text-ink-dim">{pending ? "Confirm your password to see your QR code again." : "Confirm your password to see the QR code."}</p>
          <FormAlert message={error} />
          <Field label="Password" htmlFor="totp-setup-password" required>
            <Input
              {...fieldA11y("totp-setup-password", undefined)}
              type="password"
              autoComplete="current-password"
              autoFocus
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="max-w-sm"
            />
          </Field>
          <div className="flex flex-wrap gap-3">
            <Button type="submit" loading={setup.isPending}>
              Continue
            </Button>
            <Button variant="ghost" onClick={onClose} disabled={setup.isPending}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {step.kind === "scan" && (
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
            <h4 className="text-sm font-semibold text-ink">Step 1 · Install an authenticator app</h4>
            <p className="text-sm text-ink-dim">Google Authenticator, Microsoft Authenticator, or any other TOTP app or browser extension.</p>
          </section>

          <section className="space-y-3">
            <h4 className="text-sm font-semibold text-ink">Step 2 · Scan this QR code</h4>
            <TotpQr qrCodeDataUrl={step.setup.qrCodeDataUrl} secret={step.setup.secret} showKey={showKey} onShowKey={() => setShowKey(true)} />
          </section>

          <section className="mx-auto max-w-sm space-y-3">
            <h4 className="text-sm font-semibold text-ink">Step 3 · Enter the 6-digit code from your app</h4>
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
              <Button variant="ghost" onClick={later}>
                Later
              </Button>
              <Button type="submit" loading={enable.isPending} disabled={code.length !== CODE_LENGTH} icon={<ShieldCheck className="size-4" />}>
                Verify &amp; enable
              </Button>
            </div>
          </div>
        </form>
      )}

      {step.kind === "codes" && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-ink">Save your recovery codes</h4>
          <RecoveryCodes codes={step.codes} onDone={onClose} />
        </div>
      )}
    </div>
  );
}
