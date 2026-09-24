"use client";

import { AlertTriangle, ArrowLeft, CheckCircle2, Mail, RotateCcw, Smartphone } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, fieldA11y } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { describeError as friendlyError, isApiError } from "@/lib/api/client";
import { authService, type SignupOtpChallenge } from "@/services/auth.service";
import type { AuthUser } from "@/types/api";
import { formatDuration, useCountdown } from "./login-otp-form";

const OTP_LENGTH = 6;

const isComplete = (code: string) => new RegExp(`^\\d{${OTP_LENGTH}}$`).test(code);

function describeError(error: unknown): string {
  if (!isApiError(error)) return friendlyError(error).message;
  switch (error.code) {
    // Resending replaces the code, so a rejected code is most often an older one.
    case "SIGNUP_OTP_INVALID":
      return `${error.message} Use the code from the newest email or SMS — earlier ones stop working.`;
    // The API's own wording carries the attempts left or the seconds to wait.
    case "SIGNUP_OTP_TOO_MANY_ATTEMPTS":
    case "SIGNUP_OTP_RESEND_COOLDOWN":
    case "SIGNUP_OTP_RESEND_LIMIT":
      return error.message;
    case "SIGNUP_OTP_EXPIRED":
      return "That code has expired. Request a new one below.";
    case "SIGNUP_OTP_SESSION_INVALID":
      return "This verification is no longer valid. Go back and sign up again.";
    case "OTP_DELIVERY_FAILED":
      return "We could not send the code just now. Try again in a moment.";
    case "RATE_LIMITED":
      return "Too many attempts. Wait a minute and try again.";
    case "VALIDATION_ERROR":
      return "Enter the 6-digit code we sent you.";
    default:
      return error.message;
  }
}

/**
 * Step two of signing up. One code goes to both the email and the mobile number,
 * so either message works; verifying it activates the account.
 */
export function SignupOtpForm({
  challenge: initialChallenge,
  onSuccess,
  onCancel,
}: {
  challenge: SignupOtpChallenge;
  onSuccess: (user: AuthUser) => void;
  onCancel: () => void;
}) {
  const [challenge, setChallenge] = useState(initialChallenge);
  const [code, setCode] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const expiresIn = useCountdown(challenge.expiresAt);
  const resendIn = useCountdown(challenge.resendAvailableAt);
  const expired = expiresIn === 0;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const verify = async (value: string) => {
    setFormError(null);
    setNotice(null);
    setVerifying(true);
    try {
      onSuccess(await authService.verifySignupOtp({ verificationId: challenge.verificationId, otp: value }));
    } catch (error) {
      setFormError(describeError(error));
      setCode("");
      inputRef.current?.focus();
    } finally {
      setVerifying(false);
    }
  };

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!isComplete(code)) {
      setFormError("Enter the 6-digit code we sent you.");
      return;
    }
    void verify(code);
  };

  const onResend = async () => {
    setFormError(null);
    setNotice(null);
    setResending(true);
    try {
      const next = await authService.resendSignupOtp(challenge.verificationId);
      setChallenge(next);
      setCode("");
      setNotice("A new code is on its way. Earlier codes no longer work.");
      inputRef.current?.focus();
    } catch (error) {
      setFormError(describeError(error));
    } finally {
      setResending(false);
    }
  };

  /** Digits only (so a pasted "482 913" works), capped at six, and submitted as soon as the sixth lands. */
  const onCodeChange = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, OTP_LENGTH);
    setCode(digits);
    if (digits.length === OTP_LENGTH && !verifying && !expired) void verify(digits);
  };

  const destinations = [
    { channel: "email" as const, icon: Mail, label: "Email", value: challenge.email },
    { channel: "sms" as const, icon: Smartphone, label: "SMS", value: challenge.phone },
  ];

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <ul className="grid gap-3 sm:grid-cols-2">
        {destinations.map(({ channel, icon: Icon, label, value }) => {
          const sent = challenge.channels.includes(channel);
          return (
            <li key={channel} className="flex items-center gap-3 rounded-lg border border-line bg-panel-2 px-3.5 py-3 text-sm">
              <Icon className="size-4 shrink-0 text-cyan" aria-hidden="true" />
              <span className="min-w-0">
                <span className="block font-medium text-ink">{label} OTP</span>
                <span className="block truncate text-xs text-ink-mute">{sent ? `Sent to ${value}` : `Could not send to ${value}`}</span>
              </span>
            </li>
          );
        })}
      </ul>

      {formError && (
        <div role="alert" className="flex items-start gap-3 rounded-lg border border-danger/30 bg-danger/10 px-3.5 py-3 text-sm text-danger">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {formError}
        </div>
      )}

      {notice && !formError && (
        <p role="status" className="rounded-lg border border-line bg-panel-2 px-3.5 py-3 text-sm text-ink-dim">
          {notice}
        </p>
      )}

      <Field
        label="Verification code"
        htmlFor="otp"
        required
        hint={expired ? undefined : `The same code is in your email and SMS. Expires in ${formatDuration(expiresIn)}.`}
        error={expired ? "This code has expired. Request a new one below." : undefined}
      >
        <Input
          {...fieldA11y("otp", undefined)}
          ref={inputRef}
          value={code}
          onChange={(event) => onCodeChange(event.target.value)}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={OTP_LENGTH + 2}
          placeholder="Enter 6 digit code"
          disabled={verifying}
          className="h-12 rounded-xl text-center font-mono text-xl tracking-[0.5em] placeholder:font-sans placeholder:text-sm placeholder:tracking-normal"
        />
      </Field>

      <Button type="submit" size="lg" className="h-12 w-full rounded-xl text-base" loading={verifying} disabled={expired || !isComplete(code)}>
        {verifying ? "Verifying…" : "Verify OTP"}
      </Button>

      <div className="flex flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex flex-wrap items-center gap-2 text-sm text-ink-mute">
          Didn&apos;t receive OTP?
          <Button
            variant="secondary"
            size="sm"
            onClick={onResend}
            loading={resending}
            disabled={resendIn > 0}
            icon={<RotateCcw className="size-3.5" aria-hidden="true" />}
          >
            {resendIn > 0 ? `Resend OTP (${formatDuration(resendIn)})` : "Resend OTP"}
          </Button>
        </p>
        <Button variant="ghost" size="sm" onClick={onCancel} icon={<ArrowLeft className="size-4" aria-hidden="true" />}>
          Edit details
        </Button>
      </div>
    </form>
  );
}

/** Step three: the account is active, and the user signs in with it. */
export function SignupComplete({ loginHref }: { loginHref: string }) {
  return (
    <div className="flex flex-col items-center py-4 text-center animate-fade-up">
      <span className="flex size-20 items-center justify-center rounded-full bg-lime/15 text-lime" aria-hidden="true">
        <CheckCircle2 className="size-11" strokeWidth={2.25} />
      </span>
      <h2 className="mt-6 text-2xl font-bold tracking-tight text-ink">Account created successfully!</h2>
      <p className="mt-2 max-w-sm text-ink-mute">Your account has been verified. You can now log in and start using TimeFlow.</p>
      <ButtonLink href={loginHref} replace size="lg" className="mt-8 h-12 w-full rounded-xl text-base">
        Go to login
      </ButtonLink>
    </div>
  );
}
