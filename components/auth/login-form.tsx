"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, ArrowRight, Eye, EyeOff, Lock, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, fieldA11y } from "@/components/ui/field";
import { Input, InputWithIcon } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { describeError as friendlyError, isApiError } from "@/lib/api/client";
import { authService, type LoginInput, type LoginOtpChallenge } from "@/services/auth.service";
import type { AuthUser } from "@/types/api";

/** Mobile numbers are sent with their country code; spaces, dashes and brackets are dropped. */
const MOBILE_RULE = /^\+[1-9]\d{7,14}$/;
export const normalizeMobile = (value: string) => value.replace(/[\s()-]/g, "");
export const isEmailLike = (value: string) => value.includes("@");

export const loginSchema = z.object({
  identifier: z
    .string()
    .trim()
    .min(1, "Email or mobile number is required")
    .superRefine((value, ctx) => {
      if (isEmailLike(value)) {
        if (!z.email().safeParse(value).success) ctx.addIssue({ code: "custom", message: "Enter a valid email address" });
      } else if (!MOBILE_RULE.test(normalizeMobile(value))) {
        ctx.addIssue({ code: "custom", message: "Enter a valid email, or a mobile number with its country code (e.g. +919876543210)" });
      }
    }),
  password: z.string().min(1, "Password is required"),
});

export type LoginValues = z.infer<typeof loginSchema>;

/** The API takes the email or the mobile number, never both. */
export function toLoginInput({ identifier, password }: LoginValues): LoginInput {
  const value = identifier.trim();
  return isEmailLike(value) ? { email: value, password } : { phone: normalizeMobile(value), password };
}

/** "Remember me" keeps the email or mobile number on this device, never the password. */
const REMEMBER_KEY = "tf.login.identifier";

function readRemembered(): string | null {
  try {
    return window.localStorage.getItem(REMEMBER_KEY);
  } catch {
    return null;
  }
}

function writeRemembered(identifier: string | null) {
  try {
    if (identifier) window.localStorage.setItem(REMEMBER_KEY, identifier);
    else window.localStorage.removeItem(REMEMBER_KEY);
  } catch {
    // Storage blocked (private mode): nothing to remember, and nothing breaks.
  }
}

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
  if (!isApiError(error)) return friendlyError(error).message;
  switch (error.code) {
    case "INVALID_CREDENTIALS":
      return "Invalid email / mobile number or password.";
    // The API says what to do next (verify with the signup code).
    case "ACCOUNT_NOT_VERIFIED":
      return error.message;
    case "ACCOUNT_INACTIVE":
      return "This account is deactivated. Contact an administrator.";
    case "RATE_LIMITED":
      return "Too many login attempts. Wait a minute and try again.";
    default:
      return error.message;
  }
}

/**
 * Step one. A correct password may sign the user straight in, or — with login
 * OTP enabled on the API — only earn an emailed code, in which case the parent
 * swaps in the code screen. Nothing is authenticated until one of those lands.
 */
export function LoginForm({
  onSuccess,
  onOtpRequired,
}: {
  onSuccess: (user: AuthUser) => void;
  onOtpRequired: (challenge: LoginOtpChallenge) => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema), defaultValues: { identifier: "", password: "" } });

  // Read after mount: localStorage does not exist during server rendering.
  useEffect(() => {
    const saved = readRemembered();
    if (saved) {
      setValue("identifier", saved);
      setRemember(true);
    }
  }, [setValue]);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    writeRemembered(remember ? values.identifier.trim() : null);
    try {
      const result = await authService.login(toLoginInput(values));
      if ("requiresOtp" in result) {
        onOtpRequired(result);
        return;
      }
      if ("twoFactorRequired" in result) {
        // The API supports authenticator apps; this UI does not yet, so say so
        // rather than navigating to a dashboard with no session.
        setFormError("This account uses an authenticator app, which is not supported here yet.");
        return;
      }
      onSuccess(result.user);
    } catch (error) {
      setFormError(describeError(error));
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {formError && (
        <div role="alert" className="flex items-start gap-3 rounded-lg border border-danger/30 bg-danger/10 px-3.5 py-3 text-sm text-danger">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          {formError}
        </div>
      )}

      <Field label="Email or mobile number" htmlFor="identifier" error={errors.identifier?.message} required>
        <InputWithIcon
          {...fieldA11y("identifier", errors.identifier?.message)}
          icon={<UserRound className="size-4" />}
          type="text"
          inputMode="email"
          autoComplete="username"
          placeholder="you@company.com or +91 98765 43210"
          className="h-12 rounded-xl pl-10"
          {...register("identifier")}
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

      <div className="flex items-center justify-between gap-3 text-sm">
        <label htmlFor="remember" className="flex cursor-pointer items-center gap-2 text-ink-dim">
          <Checkbox id="remember" checked={remember} onCheckedChange={(v) => setRemember(v === true)} />
          Remember me
        </label>
        <button
          type="button"
          onClick={() => setShowForgot((v) => !v)}
          aria-expanded={showForgot}
          aria-controls="forgot-password-note"
          className="font-medium text-cyan hover:underline"
        >
          Forgot password?
        </button>
      </div>
      {showForgot && (
        <p id="forgot-password-note" role="status" className="rounded-lg border border-line bg-panel-2 px-3.5 py-3 text-sm text-ink-dim">
          Ask your workspace administrator to reset it. They can send you a reset link by email.
        </p>
      )}

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
                  setValue("identifier", account.email, { shouldValidate: true });
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
    </form>
  );
}
