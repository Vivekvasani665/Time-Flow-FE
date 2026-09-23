"use client";

import { AlertTriangle, ArrowLeft, ArrowRight, MailCheck, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, fieldA11y } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { isApiError } from "@/lib/api/client";
import { authService, type LoginOtpChallenge } from "@/services/auth.service";
import type { AuthUser } from "@/types/api";

const OTP_LENGTH = 6;

/** Codes are 6 digits, so anything else is worth catching before a round trip. */
const isComplete = (code: string) => new RegExp(`^\\d{${OTP_LENGTH}}$`).test(code);

function describeError(error: unknown): string {
  if (!isApiError(error)) return "Unable to reach the server. Try again.";
  switch (error.code) {
    // Signing in again replaces the previous code, so a rejected code is most
    // often a correct one read out of an older email.
    case "LOGIN_OTP_INVALID":
      return `${error.message} Use the code from the newest email — earlier ones stop working.`;
    // The API counts down the remaining attempts in its own message, so it is
    // more informative here than anything we could write.
    case "LOGIN_OTP_TOO_MANY_ATTEMPTS":
    case "LOGIN_OTP_RESEND_COOLDOWN":
    case "LOGIN_OTP_RESEND_LIMIT":
      return error.message;
    case "LOGIN_OTP_EXPIRED":
      return "That code has expired. Request a new one below.";
    case "LOGIN_OTP_SESSION_INVALID":
      return "This sign-in attempt is no longer valid. Go back and sign in again.";
    case "EMAIL_DELIVERY_FAILED":
      return "We could not send the email just now. Try again in a moment.";
    case "ACCOUNT_INACTIVE":
      return "This account is deactivated. Contact an administrator.";
    case "RATE_LIMITED":
      return "Too many attempts. Wait a minute and try again.";
    case "VALIDATION_ERROR":
      return "Enter the 6-digit code from your email.";
    default:
      return error.message;
  }
}

/** Seconds left until `iso`, floored at 0. */
function secondsUntil(iso: string): number {
  return Math.max(0, Math.ceil((Date.parse(iso) - Date.now()) / 1000));
}

function formatDuration(seconds: number): string {
  if (seconds >= 60) {
    const minutes = Math.floor(seconds / 60);
    const rest = seconds % 60;
    return rest ? `${minutes}m ${rest}s` : `${minutes}m`;
  }
  return `${seconds}s`;
}

/**
 * A ticking countdown. Both deadlines come from the server as absolute times, so
 * this needs no clock of its own beyond the tick.
 */
function useCountdown(deadline: string): number {
  const [left, setLeft] = useState(() => secondsUntil(deadline));
  useEffect(() => {
    setLeft(secondsUntil(deadline));
    const id = setInterval(() => setLeft(secondsUntil(deadline)), 1000);
    return () => clearInterval(id);
  }, [deadline]);
  return left;
}

/**
 * Step two of signing in: the password was accepted and a code was emailed, but
 * no session exists until that code is verified here.
 */
export function LoginOtpForm({
  challenge: initialChallenge,
  onSuccess,
  onCancel,
}: {
  challenge: LoginOtpChallenge;
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

  // The code field is the only thing to do on this screen.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const verify = async (value: string) => {
    setFormError(null);
    setNotice(null);
    setVerifying(true);
    try {
      onSuccess(await authService.verifyLoginOtp({ verificationId: challenge.verificationId, otp: value }));
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
      setFormError("Enter the 6-digit code from your email.");
      return;
    }
    void verify(code);
  };

  const onResend = async () => {
    setFormError(null);
    setNotice(null);
    setResending(true);
    try {
      const next = await authService.resendLoginOtp(challenge.verificationId);
      setChallenge(next);
      setCode("");
      setNotice(`A new code is on its way to ${next.email}.`);
      inputRef.current?.focus();
    } catch (error) {
      setFormError(describeError(error));
    } finally {
      setResending(false);
    }
  };

  /** Digits only, capped at six — and submitted as soon as the sixth lands. */
  const onCodeChange = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, OTP_LENGTH);
    setCode(digits);
    if (digits.length === OTP_LENGTH && !verifying && !expired) void verify(digits);
  };

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <div className="flex items-start gap-3 rounded-lg border border-cyan/30 bg-cyan/10 px-3.5 py-3 text-sm text-ink-dim">
        <MailCheck className="mt-0.5 size-4 shrink-0 text-cyan" aria-hidden="true" />
        <p>
          We sent a {OTP_LENGTH}-digit code to <span className="font-medium text-ink">{challenge.email}</span>. Enter it below to finish signing in.
        </p>
      </div>

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
        hint={expired ? undefined : `Expires in ${formatDuration(expiresIn)}`}
        error={expired ? "This code has expired. Request a new one below." : undefined}
      >
        <Input
          {...fieldA11y("otp", undefined)}
          ref={inputRef}
          value={code}
          onChange={(event) => onCodeChange(event.target.value)}
          // A numeric keypad on mobile, and one-tap autofill of the code from the
          // mail app on iOS/Android.
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={OTP_LENGTH}
          placeholder="••••••"
          disabled={verifying}
          className="h-12 rounded-xl text-center font-mono text-xl tracking-[0.5em]"
        />
      </Field>

      <Button type="submit" size="lg" className="h-12 w-full rounded-xl text-base" loading={verifying} disabled={expired || !isComplete(code)}>
        {verifying ? "Verifying…" : "Verify and sign in"}
        {!verifying && <ArrowRight className="size-4" aria-hidden="true" />}
      </Button>

      <div className="flex flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
        <Button
          variant="secondary"
          onClick={onResend}
          loading={resending}
          disabled={resendIn > 0}
          icon={<RotateCcw className="size-4" aria-hidden="true" />}
        >
          {resendIn > 0 ? `Resend in ${formatDuration(resendIn)}` : "Send a new code"}
        </Button>
        <Button variant="ghost" onClick={onCancel} icon={<ArrowLeft className="size-4" aria-hidden="true" />}>
          Use a different account
        </Button>
      </div>

      <p className="text-center text-xs text-ink-mute">
        The code only works once. Check your spam folder if it has not arrived within a minute.
      </p>
    </form>
  );
}
