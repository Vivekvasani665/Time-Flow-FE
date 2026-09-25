"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, ArrowRight, UserRound } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, fieldA11y } from "@/components/ui/field";
import { InputWithIcon } from "@/components/ui/input";
import { describeError as friendlyError, isApiError } from "@/lib/api/client";
import { authService, type LoginOtpChallenge, type SendOtpInput } from "@/services/auth.service";
import { isEmailLike, loginSchema, normalizeMobile } from "./login-form";
import { deliveryFailureReasons } from "./otp-destinations";

const requestSchema = z.object({ identifier: loginSchema.shape.identifier });

type RequestValues = z.infer<typeof requestSchema>;

/** The API takes the email or the mobile number, never both. */
export function toSendOtpInput(identifier: string): SendOtpInput {
  const value = identifier.trim();
  return isEmailLike(value) ? { email: value } : { phone: normalizeMobile(value) };
}

function describeError(error: unknown): string {
  if (!isApiError(error)) return friendlyError(error).message;
  switch (error.code) {
    case "ACCOUNT_NOT_FOUND":
      return "No account found for this email or mobile number.";
    case "ACCOUNT_NOT_VERIFIED":
      return "This account is not verified yet. Finish signing up first.";
    case "ACCOUNT_INACTIVE":
      return "This account is deactivated. Contact an administrator.";
    // The API says how many seconds to wait.
    case "OTP_RATE_LIMITED":
      return error.message;
    case "OTP_DELIVERY_FAILED": {
      const reasons = deliveryFailureReasons(error.details);
      return reasons ? `${reasons} Try again in a moment.` : "We could not send the code just now. Try again in a moment.";
    }
    case "RATE_LIMITED":
      return "Too many code requests. Wait a few minutes and try again.";
    default:
      return error.message;
  }
}

/**
 * Passwordless sign-in, step one: the email or mobile number on the account.
 * The API sends one code by email and SMS and returns a token; the parent then
 * shows the code screen, which sends the token back with the code.
 */
export function OtpLoginRequestForm({ onSent }: { onSent: (challenge: LoginOtpChallenge) => void }) {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RequestValues>({ resolver: zodResolver(requestSchema), defaultValues: { identifier: "" } });

  const onSubmit = handleSubmit(async ({ identifier }) => {
    setFormError(null);
    try {
      onSent(await authService.sendOtp(toSendOtpInput(identifier)));
    } catch (error) {
      setFormError(describeError(error));
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {formError && (
        <div role="alert" className="flex items-start gap-3 rounded-lg border border-danger/30 bg-danger/10 px-3.5 py-3 text-sm text-danger">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {formError}
        </div>
      )}

      <Field
        label="Email or mobile number"
        htmlFor="otp-identifier"
        error={errors.identifier?.message}
        hint="We'll send a one-time code to your email and mobile number."
        required
      >
        <InputWithIcon
          {...fieldA11y("otp-identifier", errors.identifier?.message)}
          icon={<UserRound className="size-4" />}
          type="text"
          inputMode="email"
          autoComplete="username"
          placeholder="you@company.com or +91 98765 43210"
          className="h-12 rounded-xl pl-10"
          {...register("identifier")}
        />
      </Field>

      <Button type="submit" size="lg" className="h-12 w-full rounded-xl text-base" loading={isSubmitting}>
        {isSubmitting ? "Sending code…" : "Send OTP"}
        {!isSubmitting && <ArrowRight className="size-4" aria-hidden="true" />}
      </Button>
    </form>
  );
}
