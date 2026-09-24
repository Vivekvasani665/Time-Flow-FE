"use client";

import { AlertTriangle, ArrowLeft, CheckCircle2, Mail, RotateCcw, Smartphone } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, fieldA11y } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { describeError as friendlyError, isApiError } from "@/lib/api/client";
import { authService, type OtpChannel, type SignupOtpChallenge } from "@/services/auth.service";
import type { AuthUser } from "@/types/api";
import { formatDuration, useCountdown } from "./login-otp-form";

const OTP_LENGTH = 6;

const isComplete = (code: string) => new RegExp(`^\\d{${OTP_LENGTH}}$`).test(code);

const CHANNEL_NAME: Record<OtpChannel, string> = { email: "email", sms: "SMS" };

/** Safe, user-facing reason for a channel the API could not reach. Provider details stay in the server log. */
export function deliveryFailureText(code: string): string {
  switch (code) {
    case "SMS_NOT_CONFIGURED":
      return "SMS verification code could not be sent — SMS is not set up on the server yet.";
    case "SMS_BLOCKED_IN_DEVELOPMENT":
      return "SMS verification code could not be sent — real SMS is switched off in this environment.";
    case "SMS_PROVIDER_AUTH_FAILED":
      return "SMS verification code could not be sent — SMS provider authentication failed.";
    case "SMS_SEND_FAILED":
      return "SMS verification code could not be sent.";
    case "EMAIL_SEND_FAILED":
      return "Email verification code could not be sent.";
    default:
      return "The code could not be sent.";
  }
}

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
    case "OTP_DELIVERY_FAILED": {
      const reasons = error.details.map((d) => deliveryFailureText(d.message));
      return reasons.length ? `${reasons.join(" ")} Try again in a moment.` : "We could not send the code just now. Try again in a moment.";
    }
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
  const [resending, setResending] = useState<OtpChannel | null>(null);
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

  const onResend = async (channel: OtpChannel) => {
    setFormError(null);
    setNotice(null);
    setResending(channel);
    try {
      const next = await authService.resendSignupOtp(challenge.verificationId, channel);
      setChallenge(next);
      setCode("");
      setNotice(`A new code was sent by ${CHANNEL_NAME[channel]}. Earlier codes no longer work.`);
      inputRef.current?.focus();
    } catch (error) {
      setFormError(describeError(error));
    } finally {
      setResending(null);
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

  /** What each card says about the newest code. A channel left out of the last resend did not get it. */
  const statusOf = (channel: OtpChannel, value: string) => {
    const outcome = challenge.delivery[channel];
    if (outcome?.status === "failed") return { ok: false, text: deliveryFailureText(outcome.code) };
    if (outcome?.status === "sent" || (!outcome && Object.keys(challenge.delivery).length === 0 && challenge.channels.includes(channel))) {
      return { ok: true, text: `Sent to ${value}` };
    }
    return { ok: false, text: "Newest code not sent here" };
  };

  const smsFailed = challenge.delivery.sms?.status === "failed" && challenge.channels.includes("email");
  const emailFailed = challenge.delivery.email?.status === "failed" && challenge.channels.includes("sms");

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <ul className="grid gap-3 sm:grid-cols-2">
        {destinations.map(({ channel, icon: Icon, label, value }) => {
          const status = statusOf(channel, value);
          return (
            <li key={channel} className="flex items-center gap-3 rounded-lg border border-line bg-panel-2 px-3.5 py-3 text-sm">
              <Icon className={status.ok ? "size-4 shrink-0 text-cyan" : "size-4 shrink-0 text-danger"} aria-hidden="true" />
              <span className="min-w-0">
                <span className="block font-medium text-ink">{label} OTP</span>
                <span className={status.ok ? "block text-xs text-ink-mute" : "block text-xs text-danger"}>{status.text}</span>
              </span>
            </li>
          );
        })}
      </ul>

      {(smsFailed || emailFailed) && (
        <p role="status" className="flex items-start gap-3 rounded-lg border border-amber/30 bg-amber/10 px-3.5 py-3 text-sm text-ink">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber" aria-hidden="true" />
          {smsFailed
            ? "Your account was created, but we couldn't send the SMS verification code. Use the code from your email, or try Resend SMS OTP."
            : "Your account was created, but we couldn't send the email verification code. Use the code from your SMS, or try Resend Email OTP."}
        </p>
      )}

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
          {(["email", "sms"] as const).map((channel) => (
            <Button
              key={channel}
              variant="secondary"
              size="sm"
              onClick={() => void onResend(channel)}
              loading={resending === channel}
              disabled={resendIn > 0 || resending !== null}
              icon={<RotateCcw className="size-3.5" aria-hidden="true" />}
            >
              {`Resend ${channel === "email" ? "Email" : "SMS"} OTP${resendIn > 0 ? ` (${formatDuration(resendIn)})` : ""}`}
            </Button>
          ))}
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
