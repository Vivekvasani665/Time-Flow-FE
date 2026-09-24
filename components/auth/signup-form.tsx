"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, fieldA11y } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { describeError, isApiError } from "@/lib/api/client";
import { applyServerErrors } from "@/lib/form-errors";
import { authService, type SignupOtpChallenge } from "@/services/auth.service";

const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,128}$/;

export const COUNTRY_CODES = [
  { value: "+91", label: "🇮🇳 +91" },
  { value: "+1", label: "🇺🇸 +1" },
  { value: "+44", label: "🇬🇧 +44" },
  { value: "+61", label: "🇦🇺 +61" },
  { value: "+971", label: "🇦🇪 +971" },
  { value: "+65", label: "🇸🇬 +65" },
  { value: "+49", label: "🇩🇪 +49" },
];

/** The number without its country code; spaces, dashes and brackets are allowed while typing. */
const LOCAL_PHONE_RULE = /^\d{6,14}$/;
const digitsOf = (value: string) => value.replace(/[\s()-]/g, "");

export const signupSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(80, "Max 80 characters"),
  lastName: z.string().trim().min(1, "Last name is required").max(80, "Max 80 characters"),
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address").max(254),
  countryCode: z.string().min(1, "Choose a country code"),
  phone: z
    .string()
    .trim()
    .min(1, "Mobile number is required")
    .refine((v) => LOCAL_PHONE_RULE.test(digitsOf(v)), "Enter a valid mobile number"),
  password: z.string().regex(PASSWORD_RULE, "Min 8 characters with at least one letter and one number"),
});

export type SignupValues = z.infer<typeof signupSchema>;

const FIELDS = ["firstName", "lastName", "email", "phone", "password"] as const;

/**
 * Step one of signing up. The API creates an unverified account and sends a code
 * to both the email and the mobile number; the parent then shows the code screen.
 */
export function SignupForm({ onSuccess }: { onSuccess: (challenge: SignupOtpChallenge) => void }) {
  const [formError, setFormError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { firstName: "", lastName: "", email: "", countryCode: "+91", phone: "", password: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const { countryCode, phone, ...rest } = values;
      onSuccess(await authService.register({ ...rest, phone: `${countryCode}${digitsOf(phone)}` }));
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

      <Field label="Mobile number" htmlFor="phone" error={errors.phone?.message} required>
        <div className="flex gap-2">
          <Controller
            control={control}
            name="countryCode"
            render={({ field }) => (
              <Select
                aria-label="Country code"
                value={field.value}
                onValueChange={(v) => field.onChange(v ?? "+91")}
                options={COUNTRY_CODES}
                className="h-12 w-28 shrink-0 rounded-xl"
              />
            )}
          />
          <Input
            {...fieldA11y("phone", errors.phone?.message)}
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            placeholder="Enter mobile number"
            className="h-12 rounded-xl"
            {...register("phone")}
          />
        </div>
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
        {isSubmitting ? "Sending code…" : "Create account"}
      </Button>
    </form>
  );
}
