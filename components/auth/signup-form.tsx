"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, fieldA11y } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { describeError, isApiError } from "@/lib/api/client";
import { applyServerErrors } from "@/lib/form-errors";
import { authService } from "@/services/auth.service";
import type { AuthUser } from "@/types/api";

const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,128}$/;

export const signupSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(80, "Max 80 characters"),
  lastName: z.string().trim().min(1, "Last name is required").max(80, "Max 80 characters"),
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address").max(254),
  password: z.string().regex(PASSWORD_RULE, "Min 8 characters with at least one letter and one number"),
});

export type SignupValues = z.infer<typeof signupSchema>;

const FIELDS = ["firstName", "lastName", "email", "password"] as const;

export function SignupForm({ onSuccess }: { onSuccess: (user: AuthUser) => void }) {
  const [formError, setFormError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { firstName: "", lastName: "", email: "", password: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      onSuccess(await authService.register(values));
    } catch (error) {
      if (!isApiError(error)) return setFormError(describeError(error).message);
      if (error.code === "RATE_LIMITED") return setFormError("Too many sign-up attempts. Wait a minute and try again.");
      // Email already taken and validation details land on their fields; anything else is a toast.
      applyServerErrors(error, setError, FIELDS);
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

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="First name" htmlFor="firstName" error={errors.firstName?.message} required>
          <Input {...fieldA11y("firstName", errors.firstName?.message)} autoComplete="given-name" className="h-12 rounded-xl" {...register("firstName")} />
        </Field>
        <Field label="Last name" htmlFor="lastName" error={errors.lastName?.message} required>
          <Input {...fieldA11y("lastName", errors.lastName?.message)} autoComplete="family-name" className="h-12 rounded-xl" {...register("lastName")} />
        </Field>
      </div>

      <Field label="Email" htmlFor="email" error={errors.email?.message} required>
        <Input
          {...fieldA11y("email", errors.email?.message)}
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          className="h-12 rounded-xl"
          {...register("email")}
        />
      </Field>

      <Field label="Password" htmlFor="password" error={errors.password?.message} hint="Min 8 characters, letters and numbers." required>
        <div className="relative">
          <Input
            {...fieldA11y("password", errors.password?.message)}
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="••••••••"
            className="h-12 rounded-xl pr-11"
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

      <Button type="submit" size="lg" className="h-12 w-full rounded-xl text-base" loading={isSubmitting}>
        {isSubmitting ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}
