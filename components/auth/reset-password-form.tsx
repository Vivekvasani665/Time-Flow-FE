"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Check, CircleCheck, Eye, EyeOff, LockKeyhole, TriangleAlert } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useForm, useWatch, type UseFormRegisterReturn } from "react-hook-form";
import { z } from "zod";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, fieldA11y } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { isApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { passwordResetService } from "@/services/password-reset.service";

/** Mirrors the API's policy for reset passwords; the server checks it again. */
export const PASSWORD_REQUIREMENTS = [
  { label: "At least 8 characters", test: (v: string) => v.length >= 8 },
  { label: "One uppercase letter", test: (v: string) => /[A-Z]/.test(v) },
  { label: "One lowercase letter", test: (v: string) => /[a-z]/.test(v) },
  { label: "One number", test: (v: string) => /\d/.test(v) },
  { label: "One special character", test: (v: string) => /[^A-Za-z0-9]/.test(v) },
] as const;

export const resetPasswordSchema = z
  .object({
    newPassword: z
      .string()
      .min(1, "New password is required")
      .max(128, "Password must be at most 128 characters")
      .refine((v) => PASSWORD_REQUIREMENTS.every((r) => r.test(v)), "Password does not meet the requirements below"),
    confirmPassword: z.string().min(1, "Confirm your new password"),
  })
  .refine((v) => v.newPassword === v.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match." });

type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

type LinkProblem = "invalid" | "expired";

const problemOf = (error: unknown): LinkProblem | null => {
  if (!isApiError(error)) return null;
  if (error.code === "PASSWORD_RESET_EXPIRED") return "expired";
  if (error.code === "PASSWORD_RESET_INVALID") return "invalid";
  return null;
};

function StatusCard({ icon, tone, title, children, action }: { icon: ReactNode; tone: "lime" | "danger" | "amber"; title: string; children: ReactNode; action: ReactNode }) {
  const toneClass = { lime: "bg-lime/10 text-lime", danger: "bg-danger/10 text-danger", amber: "bg-amber/10 text-amber" }[tone];
  return (
    <div className="text-center" role="status">
      <span className={cn("mx-auto flex size-14 items-center justify-center rounded-2xl", toneClass)} aria-hidden="true">
        {icon}
      </span>
      <h1 className="mt-5 text-2xl font-bold tracking-tight text-ink">{title}</h1>
      <div className="mt-2 space-y-2 text-ink-mute">{children}</div>
      <div className="mt-8">{action}</div>
    </div>
  );
}

function PasswordInput({ id, label, error, registration, autoFocus }: { id: string; label: string; error?: string; registration: UseFormRegisterReturn; autoFocus?: boolean }) {
  const [visible, setVisible] = useState(false);
  return (
    <Field label={label} htmlFor={id} error={error} required>
      <div className="relative">
        <Input
          {...fieldA11y(id, error)}
          type={visible ? "text" : "password"}
          autoComplete="new-password"
          placeholder="••••••••"
          className="h-12 rounded-xl pr-11"
          autoFocus={autoFocus}
          {...registration}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute top-1/2 right-1.5 z-10 -translate-y-1/2 rounded-md p-1.5 text-ink-mute hover:text-ink"
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          aria-pressed={visible}
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    </Field>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [done, setDone] = useState(false);
  const [linkProblem, setLinkProblem] = useState<LinkProblem | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Checked up front so a dead link says so before the member types anything.
  const check = useQuery({
    queryKey: ["password-reset-link", token],
    queryFn: () => passwordResetService.verifyPasswordResetToken(token),
    enabled: token !== "",
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordValues>({ resolver: zodResolver(resetPasswordSchema), defaultValues: { newPassword: "", confirmPassword: "" } });
  const newPassword = useWatch({ control, name: "newPassword" });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await passwordResetService.resetPassword({ token, ...values });
      setDone(true);
    } catch (error) {
      const problem = problemOf(error);
      if (problem) return setLinkProblem(problem);
      if (!isApiError(error)) return setFormError("Unable to reach the server. Try again.");
      if (error.code === "RATE_LIMITED") return setFormError("Too many attempts. Wait a few minutes and try again.");
      const fieldErrors = error.details.filter((d) => d.path === "newPassword" || d.path === "confirmPassword");
      for (const d of fieldErrors) setError(d.path as keyof ResetPasswordValues, { type: "server", message: d.message });
      if (fieldErrors.length === 0) setFormError(error.message);
    }
  });

  if (done) {
    return (
      <StatusCard
        icon={<CircleCheck className="size-7" />}
        tone="lime"
        title="Password Reset Successfully"
        action={
          <ButtonLink href="/login" size="lg" className="h-12 w-full rounded-xl text-base">
            Go to Login
          </ButtonLink>
        }
      >
        <p>Your password has been updated. You can now log in with your new password.</p>
        <p className="text-sm">For your security, you have been signed out on all devices.</p>
      </StatusCard>
    );
  }

  const problem: LinkProblem | null = token === "" ? "invalid" : (linkProblem ?? problemOf(check.error));
  if (problem || check.isError) {
    return (
      <StatusCard
        icon={<TriangleAlert className="size-7" />}
        tone={problem === "expired" ? "amber" : "danger"}
        title={problem === "expired" ? "Reset Link Expired" : problem ? "Reset Link Invalid" : "Something went wrong"}
        action={
          <ButtonLink href="/login" variant="secondary" size="lg" className="h-12 w-full rounded-xl text-base">
            Back to Login
          </ButtonLink>
        }
      >
        {problem ? (
          <>
            <p>{problem === "expired" ? "This password reset link has expired." : "This password reset link is invalid or has already been used."}</p>
            <p className="text-sm">Request a new password reset link from your administrator.</p>
          </>
        ) : (
          <p>We could not check your reset link. Refresh the page to try again.</p>
        )}
      </StatusCard>
    );
  }

  if (check.isLoading) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-ink-mute" role="status">
        <Spinner className="size-6 text-cyan" />
        Checking your reset link…
      </div>
    );
  }

  return (
    <>
      <div className="text-center">
        <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-cyan/10 text-cyan" aria-hidden="true">
          <LockKeyhole className="size-7" />
        </span>
        <h1 className="mt-5 text-2xl font-bold tracking-tight text-ink sm:text-3xl">Reset Your Password</h1>
        <p className="mt-2 mb-8 text-ink-mute">Create a new password for your account.</p>
      </div>

      <form onSubmit={onSubmit} noValidate className="space-y-5">
        {formError && (
          <div role="alert" className="flex items-start gap-3 rounded-lg border border-danger/30 bg-danger/10 px-3.5 py-3 text-sm text-danger">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            {formError}
          </div>
        )}

        <PasswordInput id="newPassword" label="New Password" error={errors.newPassword?.message} registration={register("newPassword")} autoFocus />
        <PasswordInput id="confirmPassword" label="Confirm Password" error={errors.confirmPassword?.message} registration={register("confirmPassword")} />

        <div className="rounded-xl border border-line bg-panel-2 px-4 py-3.5">
          <p className="text-sm font-medium text-ink" id="password-requirements">
            Password requirements:
          </p>
          <ul className="mt-2 grid gap-1.5 text-sm sm:grid-cols-2" aria-labelledby="password-requirements">
            {PASSWORD_REQUIREMENTS.map((r) => {
              const met = r.test(newPassword ?? "");
              return (
                <li key={r.label} className={cn("flex items-center gap-2 transition-colors", met ? "text-lime" : "text-ink-mute")}>
                  <Check className={cn("size-4 shrink-0", !met && "opacity-30")} aria-hidden="true" />
                  {r.label}
                  <span className="sr-only">{met ? "(met)" : "(not met)"}</span>
                </li>
              );
            })}
          </ul>
        </div>

        <Button type="submit" size="lg" className="h-12 w-full rounded-xl text-base" loading={isSubmitting}>
          {isSubmitting ? "Resetting password…" : "Reset Password"}
        </Button>
      </form>
    </>
  );
}
