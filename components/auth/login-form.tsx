"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, fieldA11y } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { isApiError } from "@/lib/api/client";
import { authService } from "@/services/auth.service";
import type { AuthUser } from "@/types/api";

export const loginSchema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export type LoginValues = z.infer<typeof loginSchema>;

export const DEMO_ACCOUNTS = [
  { role: "Super Admin", email: "superadmin@timeflow.dev" },
  { role: "Admin", email: "admin@timeflow.dev" },
  { role: "Manager", email: "manager@timeflow.dev" },
  { role: "Employee", email: "employee@timeflow.dev" },
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

export function LoginForm({ onSuccess }: { onSuccess: (user: AuthUser) => void }) {
  const [formError, setFormError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const user = await authService.login(values);
      onSuccess(user);
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

      <Field label="Email" htmlFor="email" error={errors.email?.message} required>
        <Input
          {...fieldA11y("email", errors.email?.message)}
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          className="h-10"
          {...register("email")}
        />
      </Field>

      <Field label="Password" htmlFor="password" error={errors.password?.message} required>
        <div className="relative">
          <Input
            {...fieldA11y("password", errors.password?.message)}
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="••••••••"
            className="h-10 pr-10"
            {...register("password")}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute top-1/2 right-1.5 z-10 -translate-y-1/2 rounded-md p-1.5 text-ink-mute hover:text-ink"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </Field>

      <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
        {isSubmitting ? "Signing in…" : "Sign in"}
      </Button>

      {SHOW_DEMO_ACCOUNTS && (
        <div className="space-y-3 pt-2">
          <p className="flex items-center gap-3 text-xs text-ink-mute">
            <span className="h-px flex-1 bg-line" />
            Demo accounts
            <span className="h-px flex-1 bg-line" />
          </p>
          <div className="grid grid-cols-2 gap-2">
            {DEMO_ACCOUNTS.map((account) => (
              <button
                key={account.email}
                type="button"
                onClick={() => {
                  setFormError(null);
                  setValue("email", account.email, { shouldValidate: true });
                  setValue("password", DEMO_PASSWORD, { shouldValidate: true });
                }}
                className="group flex flex-col items-start gap-0.5 rounded-lg border border-line bg-panel px-3 py-2 text-left transition hover:border-line-bright hover:bg-panel-2"
              >
                <span className="text-sm font-medium text-ink">{account.role}</span>
                <span className="w-full truncate text-xs text-ink-mute">{account.email}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </form>
  );
}
