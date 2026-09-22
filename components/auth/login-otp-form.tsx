"use client";

import { AlertTriangle, ArrowLeft, ArrowRight, Clock, MailCheck, RotateCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ClipboardEvent, type FormEvent, type KeyboardEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { isApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { authService, type LoginOtpChallenge } from "@/services/auth.service";
import type { AuthUser } from "@/types/api";

const LENGTH = 6;

/** `mm:ss` from whole seconds. */
export function formatCountdown(seconds: number): string {
  const s = Math.max(0, seconds);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/** Deadlines on this device's clock, anchored when the server answered. */
function deadlines(challenge: LoginOtpChallenge) {
  const now = Date.now();
  return { expiresAt: now + challenge.expiresInSeconds * 1000, resendAt: now + challenge.resendAvailableInSeconds * 1000 };
}

type Failure = {
  message: string;
  /** Verifying is pointless until a new code arrives. */
  needsNewCode?: boolean;
  /** This attempt is dead; back to the password step. */
  restart?: boolean;
};

/** User-facing wording for every failure. Internal server messages are never shown as-is. */
function describe(error: unknown, action: "verify" | "resend"): Failure {
  if (!isApiError(error)) return { message: "Something went wrong. Please try again later." };
  switch (error.code) {
    case "NETWORK_ERROR":
      return {
        message:
          action === "verify"
            ? "Unable to verify the code. Please check your connection and try again."
            : "Unable to send a new code. Please check your connection and try again.",
      };
    case "LOGIN_OTP_INVALID": {
      // Only the attempts count is taken from the server's "Incorrect code. 3 attempts left."
      const left = /(\d+) attempts? left/.exec(error.message)?.[1];
      const suffix = left ? ` ${left} ${left === "1" ? "attempt" : "attempts"} left.` : "";
      return { message: `Invalid verification code. Please try again.${suffix}` };
    }
    case "LOGIN_OTP_EXPIRED":
      return { message: "Your verification code has expired. Please request a new code.", needsNewCode: true };
    case "LOGIN_OTP_TOO_MANY_ATTEMPTS":
      return { message: "Too many incorrect attempts. Please request a new code.", needsNewCode: true };
    case "LOGIN_OTP_RESEND_COOLDOWN":
      return { message: "Please wait a moment before requesting another code." };
    case "LOGIN_OTP_RESEND_LIMIT":
      return { message: "Too many codes requested. Please sign in again.", restart: true };
    case "LOGIN_OTP_SESSION_INVALID":
    case "UNAUTHENTICATED":
      return { message: "Your sign-in session has expired. Please sign in again.", restart: true };
    case "EMAIL_DELIVERY_FAILED":
      return { message: "We couldn't send the verification email. Please try again in a moment." };
    case "ACCOUNT_INACTIVE":
      return { message: "This account is deactivated. Contact an administrator.", restart: true };
    case "RATE_LIMITED":
      return { message: "Too many requests. Please wait and try again." };
    default:
      if (error.status === 429) return { message: "Too many requests. Please wait and try again." };
      // The attempt this screen belongs to is gone server-side.
      if (error.status === 401 || error.status === 404) return { message: "Your sign-in session has expired. Please sign in again.", restart: true };
      if (error.status >= 500) return { message: "Something went wrong. Please try again later." };
      return { message: "Something went wrong. Please try again." };
  }
}

/** Six single-digit boxes that behave like one field: typing advances, backspace retreats, paste fills. */
function OtpInput({ value, onChange, disabled, invalid }: { value: string[]; onChange: (next: string[]) => void; disabled?: boolean; invalid?: boolean }) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const focus = (i: number) => refs.current[Math.max(0, Math.min(LENGTH - 1, i))]?.focus();

  const fillFrom = (start: number, digits: string) => {
    const next = [...value];
    let i = start;
    for (const d of digits) {
      if (i >= LENGTH) break;
      next[i++] = d;
    }
    onChange(next);
    focus(i);
  };

  const onInput = (i: number, raw: string) => {
    const digits = raw.replace(/\D/g, "");
    if (!digits) {
      const next = [...value];
      next[i] = "";
      onChange(next);
      return;
    }
    // More than one digit arrives from autofill (SMS/email "one-time-code") or fast typing.
    fillFrom(digits.length > 1 ? 0 : i, digits.length > 1 ? digits.slice(0, LENGTH) : digits);
  };

  const onKeyDown = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !value[i] && i > 0) {
      e.preventDefault();
      const next = [...value];
      next[i - 1] = "";
      onChange(next);
      focus(i - 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      focus(i - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      focus(i + 1);
    }
  };

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const digits = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, LENGTH);
    if (!digits) return;
    e.preventDefault();
    fillFrom(0, digits);
  };

  return (
    <div className="flex justify-between gap-2 sm:gap-3">
      {value.map((digit, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          value={digit}
          onChange={(e) => onInput(i, e.target.value)}
          onKeyDown={(e) => onKeyDown(i, e)}
          onPaste={onPaste}
          onFocus={(e) => e.target.select()}
          disabled={disabled}
          autoFocus={i === 0}
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={i === 0 ? LENGTH : 1}
          aria-label={`Digit ${i + 1} of ${LENGTH}`}
          aria-invalid={invalid || undefined}
          className={cn(
            "field-input h-14 w-full min-w-0 rounded-xl text-center font-mono text-2xl font-semibold text-ink sm:h-16",
            invalid && "border-danger",
          )}
        />
      ))}
    </div>
  );
}

/** Second sign-in step when the server emailed a one-time code. */
export function LoginOtpForm({
  challenge: initial,
  onSuccess,
  onRestart,
}: {
  challenge: LoginOtpChallenge;
  onSuccess: (user: AuthUser) => void;
  /** Back to the password step, optionally explaining why. */
  onRestart: (reason?: string) => void;
}) {
  // The code lives only in component state — never in storage.
  const [digits, setDigits] = useState<string[]>(() => Array(LENGTH).fill(""));
  const [challenge, setChallenge] = useState(initial);
  const [{ expiresAt, resendAt }, setDeadlines] = useState(() => deadlines(initial));
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState<Failure | null>(null);
  const [locked, setLocked] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const secondsLeft = Math.ceil((expiresAt - now) / 1000);
  const expired = secondsLeft <= 0;
  const resendIn = Math.max(0, Math.ceil((resendAt - now) / 1000));
  const code = digits.join("");
  const canVerify = code.length === LENGTH && !expired && !locked && !verifying;

  const fail = useCallback(
    (err: unknown, action: "verify" | "resend") => {
      const failure = describe(err, action);
      if (failure.restart) return onRestart(failure.message);
      if (failure.needsNewCode) setLocked(true);
      setError(failure);
    },
    [onRestart],
  );

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canVerify) return;
    setError(null);
    setVerifying(true);
    try {
      onSuccess(await authService.verifyLoginOtp(challenge.verificationId, code));
    } catch (err) {
      setDigits(Array(LENGTH).fill(""));
      fail(err, "verify");
    } finally {
      setVerifying(false);
    }
  };

  const onResend = async () => {
    if (resendIn > 0 || resending) return;
    setError(null);
    setResending(true);
    try {
      const next = await authService.resendLoginOtp(challenge.verificationId);
      setChallenge(next);
      setDeadlines(deadlines(next));
      setNow(Date.now());
      setDigits(Array(LENGTH).fill(""));
      setLocked(false);
      toast.success("New verification code sent.", { description: `Check ${next.email} for your new code.` });
    } catch (err) {
      fail(err, "resend");
    } finally {
      setResending(false);
    }
  };

  const status = expired ? "Code expired" : `Code expires in ${formatCountdown(secondsLeft)}`;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <div className="flex items-start gap-3 rounded-xl border border-cyan/30 bg-cyan/5 px-4 py-3.5">
        <MailCheck className="mt-0.5 size-5 shrink-0 text-cyan" aria-hidden="true" />
        <p className="text-sm text-ink-mute">
          We sent a code to <span className="font-medium text-ink">{challenge.email}</span>. It may take a minute to arrive — check your spam folder too.
        </p>
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-3 rounded-lg border border-danger/30 bg-danger/10 px-3.5 py-3 text-sm text-danger">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          {error.message}
        </div>
      )}

      <fieldset className="space-y-3">
        <legend className="mb-3 text-sm font-medium text-ink">Verification code</legend>
        <OtpInput value={digits} onChange={setDigits} disabled={verifying || locked || expired} invalid={Boolean(error) && !locked} />
        {/* Visible every second, but announced only when it matters — a per-second live region would be noise. */}
        <p
          role="timer"
          className={cn("flex items-center justify-center gap-1.5 text-sm", expired ? "font-medium text-danger" : "text-ink-mute")}
        >
          <Clock className="size-4" aria-hidden="true" />
          {status}
        </p>
        <p aria-live="polite" className="sr-only">
          {expired ? "Code expired. Request a new code." : secondsLeft <= 60 ? "Code expires in less than a minute." : ""}
        </p>
      </fieldset>

      <Button type="submit" size="lg" className="h-12 w-full rounded-xl text-base" loading={verifying} disabled={!canVerify}>
        {verifying ? "Verifying…" : "Verify"}
        {!verifying && <ArrowRight className="size-4" aria-hidden="true" />}
      </Button>

      <div className="space-y-4 border-t border-line pt-5 text-center text-sm">
        <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-ink-mute">
          Didn&apos;t receive it?
          <button
            type="button"
            onClick={onResend}
            disabled={resendIn > 0 || resending}
            className="inline-flex items-center gap-1.5 rounded font-medium text-cyan hover:underline disabled:cursor-not-allowed disabled:text-ink-mute disabled:no-underline"
          >
            <RotateCw className={cn("size-4", resending && "animate-spin")} aria-hidden="true" />
            {resending ? "Sending…" : resendIn > 0 ? `Resend available in ${resendIn}s` : "Resend OTP"}
          </button>
        </p>
        <Button variant="ghost" size="lg" className="w-full rounded-xl" onClick={() => onRestart()} disabled={verifying}>
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to Login
        </Button>
      </div>
    </form>
  );
}
