"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, ArrowLeft, ArrowRight, Eye, EyeOff, KeyRound, Lock, Mail, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, fieldA11y } from "@/components/ui/field";
import { Input, InputWithIcon } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { isApiError } from "@/lib/api/client";
import { authService, type TwoFactorChallenge } from "@/services/auth.service";
import type { AuthUser } from "@/types/api";

export const loginSchema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export type LoginValues = z.infer<typeof loginSchema>;

const twoFactorSchema = z.object({ code: z.string().trim().min(6, "Enter the code from your authenticator app").max(32) });

type TwoFactorValues = z.infer<typeof twoFactorSchema>;

export const DEMO_ACCOUNTS = [
  { role: "Super Admin", email: "superadmin@timeflow.dev", initials: "SA", tone: "bg-blue" },
  { role: "Admin", email: "admin@timeflow.dev", initials: "AD", tone: "bg-lime" },
  { role: "Manager", email: "manager@timeflow.dev", initials: "MN", tone: "bg-violet" },
  { role: "Employee", email: "employee@timeflow.dev", initials: "EM", tone: "bg-amber" },
] as const;

export const DEMO_PASSWORD = "Password123!";

/** Demo accounts are not seeded in production, so their shortcuts are hidden there unless opted in. */
const SHOW_DEMO_ACCOUNTS = process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS === "true";

function describeError(error: unknown): string {
  if (!isApiError(error)) return "Unable to reach the server. Try again.";
  switch (error.code) {
    case "INVALID_CREDENTIALS":
      return "Invalid email or password.";
    case "ACCOUNT_INACTIVE":
      return "This account is deactivated. Contact an administrator.";
    case "RATE_LIMITED":
      return "Too many login attempts. Wait a minute and try again.";
    default:
      return error.message;
  }
}

/** Second sign-in step for accounts with two-factor authentication. */
function TwoFactorForm({
  challenge,
  onSuccess,
  onRestart,
}: {
  challenge: TwoFactorChallenge;
  onSuccess: (user: AuthUser) => void;
  /** Back to the password step, optionally explaining why. */
  onRestart: (reason?: string) => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<TwoFactorValues>({ resolver: zodResolver(twoFactorSchema), defaultValues: { code: "" } });

  const onSubmit = handleSubmit(async ({ code }) => {
    setFormError(null);
    try {
      const { user, recoveryCodesRemaining } = await authService.loginTwoFactor(challenge.challengeToken, code);
      if (recoveryCodesRemaining !== undefined) {
        toast.warning("Recovery code used", {
          description:
            recoveryCodesRemaining === 0
              ? "You have no recovery codes left. Generate new ones in your security settings."
              : `You have ${recoveryCodesRemaining} recovery code${recoveryCodesRemaining === 1 ? "" : "s"} left.`,
        });
      }
      onSuccess(user);
    } catch (error) {
      if (isApiError(error) && error.code === "TWO_FACTOR_CHALLENGE_INVALID") return onRestart(error.message);
      if (isApiError(error) && error.code === "INVALID_TWO_FACTOR_CODE") {
        setError("code", { type: "server", message: error.message }, { shouldFocus: true });
        return;
      }
      if (isApiError(error) && error.code === "RATE_LIMITED") return setFormError("Too many code attempts. Wait a few minutes and try again.");
      setFormError(describeError(error));
    }
  });

  const toggleMode = () => {
    setUseRecoveryCode((v) => !v);
    setFormError(null);
    reset({ code: "" });
  };

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <div className="flex items-start gap-3 rounded-xl border border-cyan/30 bg-cyan/5 px-4 py-3.5">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-cyan" aria-hidden="true" />
        <div className="text-sm">
          <p className="font-medium text-ink">Two-factor authentication</p>
          <p className="mt-0.5 text-ink-mute">
            {useRecoveryCode
              ? "Enter one of the recovery codes you saved when you turned on two-factor authentication."
              : "Open your authenticator app and enter the 6-digit code for TimeFlow."}
          </p>
        </div>
      </div>

      {formError && (
        <div role="alert" className="flex items-start gap-3 rounded-lg border border-danger/30 bg-danger/10 px-3.5 py-3 text-sm text-danger">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          {formError}
        </div>
      )}

      <Field label={useRecoveryCode ? "Recovery code" : "Authentication code"} htmlFor="code" error={errors.code?.message} required>
        <InputWithIcon
          {...fieldA11y("code", errors.code?.message)}
          icon={<KeyRound className="size-4" />}
          autoFocus
          autoComplete="one-time-code"
          inputMode={useRecoveryCode ? "text" : "numeric"}
          placeholder={useRecoveryCode ? "xxxxx-xxxxx" : "123456"}
          maxLength={useRecoveryCode ? 32 : 6}
          className="h-12 rounded-xl pl-10 font-mono tracking-widest"
          {...register("code")}
        />
      </Field>

      <Button type="submit" size="lg" className="h-12 w-full rounded-xl text-base" loading={isSubmitting}>
        {isSubmitting ? "Verifying…" : "Verify and sign in"}
        {!isSubmitting && <ArrowRight className="size-4" aria-hidden="true" />}
      </Button>

      <div className="flex items-center justify-between gap-3 border-t border-line pt-5 text-sm">
        <button type="button" onClick={() => onRestart()} className="inline-flex items-center gap-1.5 text-ink-mute hover:text-ink">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back
        </button>
        <button type="button" onClick={toggleMode} className="font-medium text-cyan hover:underline">
          {useRecoveryCode ? "Use authenticator app" : "Use a recovery code"}
        </button>
      </div>

      <p className="text-center text-xs text-ink-mute">
        Lost your phone and recovery codes? <span className="text-ink-dim">Ask your workspace administrator to reset two-factor authentication.</span>
      </p>
    </form>
  );
}

export function LoginForm({ onSuccess }: { onSuccess: (user: AuthUser) => void }) {
  const [formError, setFormError] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<TwoFactorChallenge | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const {
    register,
    handleSubmit,
    setValue,
    resetField,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const result = await authService.login(values);
      if (result.twoFactorRequired) setChallenge({ challengeToken: result.challengeToken, challengeExpiresAt: result.challengeExpiresAt });
      else onSuccess(result.user);
    } catch (error) {
      setFormError(describeError(error));
    }
  });

  if (challenge) {
    return (
      <TwoFactorForm
        challenge={challenge}
        onSuccess={onSuccess}
        onRestart={(reason) => {
          setChallenge(null);
          resetField("password");
          setFormError(reason ?? null);
        }}
      />
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {formError && (
        <div role="alert" className="flex items-start gap-3 rounded-lg border border-danger/30 bg-danger/10 px-3.5 py-3 text-sm text-danger">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          {formError}
        </div>
      )}

      <Field label="Email address" htmlFor="email" error={errors.email?.message} required>
        <InputWithIcon
          {...fieldA11y("email", errors.email?.message)}
          icon={<Mail className="size-4" />}
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          className="h-12 rounded-xl pl-10"
          {...register("email")}
        />
      </Field>

      <Field label="Password" htmlFor="password" error={errors.password?.message} required>
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-3 z-10 flex items-center text-ink-mute" aria-hidden="true">
            <Lock className="size-4" />
          </span>
          <Input
            {...fieldA11y("password", errors.password?.message)}
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="••••••••"
            className="h-12 rounded-xl pr-11 pl-10"
            {...register("password")}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute top-1/2 right-2 z-10 -translate-y-1/2 rounded-md p-1.5 text-ink-mute hover:text-ink"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </Field>

      <Button type="submit" size="lg" className="h-12 w-full rounded-xl text-base" loading={isSubmitting}>
        {isSubmitting ? "Signing in…" : "Sign in"}
        {!isSubmitting && <ArrowRight className="size-4" aria-hidden="true" />}
      </Button>

      {SHOW_DEMO_ACCOUNTS && (
        <div className="space-y-4 pt-2">
          <p className="flex items-center gap-3 text-xs text-ink-mute">
            <span className="h-px flex-1 bg-line" />
            or continue with a demo account
            <span className="h-px flex-1 bg-line" />
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {DEMO_ACCOUNTS.map((account) => (
              <button
                key={account.email}
                type="button"
                onClick={() => {
                  setFormError(null);
                  setValue("email", account.email, { shouldValidate: true });
                  setValue("password", DEMO_PASSWORD, { shouldValidate: true });
                }}
                className="flex items-center gap-2.5 rounded-xl border border-line bg-panel px-3 py-3 text-left transition hover:border-cyan/40 hover:bg-panel-2"
              >
                <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full text-[0.7rem] font-semibold text-white", account.tone)} aria-hidden="true">
                  {account.initials}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-ink">{account.role}</span>
                  <span className="block truncate text-xs text-ink-mute">{account.email}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="border-t border-line pt-5 text-center text-xs text-ink-mute">
        Forgot your password? <span className="text-ink-dim">Ask your workspace administrator to reset it.</span>
      </p>
    </form>
  );
}
