"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CircleCheck, PartyPopper, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { PASSWORD_REQUIREMENTS, PasswordInput, PasswordRequirements, StatusCard } from "@/components/auth/reset-password-form";
import { RankBadge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { isApiError } from "@/lib/api/client";
import { invitationsService } from "@/services/invitations.service";

const REDIRECT_MS = 2000;

/** Same policy the API applies to invitation passwords; the server checks it again. */
export const acceptInvitationSchema = z
  .object({
    password: z
      .string()
      .min(1, "Password is required")
      .max(128, "Password must be at most 128 characters")
      .refine((v) => PASSWORD_REQUIREMENTS.every((r) => r.test(v)), "Password does not meet the requirements below"),
    confirmPassword: z.string().min(1, "Confirm your password"),
  })
  .refine((v) => v.password === v.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match." });

type AcceptInvitationValues = z.infer<typeof acceptInvitationSchema>;

/** The API answers "never existed", "expired", "already used" and "revoked" alike, on purpose. */
const isDeadLink = (error: unknown) =>
  isApiError(error) && (error.code === "INVITATION_LINK_INVALID" || error.status === 404 || error.status === 410);

export function AcceptInvitationForm({ token }: { token: string }) {
  const router = useRouter();
  const [done, setDone] = useState(false);
  const [linkDead, setLinkDead] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Nothing is shown until the API confirms the link, so a dead one never reaches the form.
  const check = useQuery({
    queryKey: ["invitation-link", token],
    queryFn: () => invitationsService.verify(token),
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
  } = useForm<AcceptInvitationValues>({ resolver: zodResolver(acceptInvitationSchema), defaultValues: { password: "", confirmPassword: "" } });
  const password = useWatch({ control, name: "password" });

  useEffect(() => {
    if (!done) return;
    const timer = setTimeout(() => router.replace("/login"), REDIRECT_MS);
    return () => clearTimeout(timer);
  }, [done, router]);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await invitationsService.accept({ token, ...values });
      setDone(true);
    } catch (error) {
      if (isDeadLink(error)) return setLinkDead(true);
      if (!isApiError(error)) return setFormError("Unable to reach the server. Try again.");
      if (error.code === "RATE_LIMITED") return setFormError("Too many attempts. Wait a few minutes and try again.");
      if (error.code === "USER_EMAIL_EXISTS") return setFormError("An account with this email already exists. Go to the login page to sign in.");
      const fieldErrors = error.details.filter((d) => d.path === "password" || d.path === "confirmPassword");
      for (const d of fieldErrors) setError(d.path as keyof AcceptInvitationValues, { type: "server", message: d.message });
      if (fieldErrors.length === 0) setFormError(error.status >= 500 ? "Unable to set your password. Please try again." : error.message);
    }
  });

  if (done) {
    return (
      <StatusCard
        icon={<CircleCheck className="size-7" />}
        tone="lime"
        title="Password Set Successfully"
        action={
          <ButtonLink href="/login" size="lg" className="h-12 w-full rounded-xl text-base">
            Go to Login
          </ButtonLink>
        }
      >
        <p>Your account has been created successfully.</p>
        <p className="text-sm">You can now log in using your invited email and password. Redirecting to login…</p>
      </StatusCard>
    );
  }

  if (token === "" || linkDead || isDeadLink(check.error)) {
    return (
      <StatusCard
        icon={<TriangleAlert className="size-7" />}
        tone="amber"
        title="Invitation Link Expired"
        action={
          <ButtonLink href="/login" variant="secondary" size="lg" className="h-12 w-full rounded-xl text-base">
            Go to Login
          </ButtonLink>
        }
      >
        <p>This invitation link is invalid, expired, or has already been used.</p>
        <p className="text-sm">Ask your administrator for a new invitation link.</p>
      </StatusCard>
    );
  }

  if (check.isError) {
    return (
      <StatusCard
        icon={<TriangleAlert className="size-7" />}
        tone="danger"
        title="Something went wrong"
        action={
          <Button variant="secondary" size="lg" className="h-12 w-full rounded-xl text-base" onClick={() => void check.refetch()} loading={check.isFetching}>
            Try again
          </Button>
        }
      >
        <p>We could not check your invitation link. Please try again.</p>
      </StatusCard>
    );
  }

  if (check.isLoading || !check.data) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center" role="status">
        <Spinner className="size-6 text-cyan" />
        <p className="font-medium text-ink">Checking Invitation…</p>
        <p className="text-sm text-ink-mute">Please wait while we verify your invitation link.</p>
      </div>
    );
  }

  const invite = check.data;

  return (
    <>
      <div className="text-center">
        <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-cyan/10 text-cyan" aria-hidden="true">
          <PartyPopper className="size-7" />
        </span>
        <h1 className="mt-5 text-2xl font-bold tracking-tight text-ink sm:text-3xl">Welcome to TimeFlow</h1>
        <p className="mt-2 mb-8 text-ink-mute">You&apos;ve been invited to join TimeFlow. Set a password to activate your account.</p>
      </div>

      <form onSubmit={onSubmit} noValidate className="space-y-5">
        {formError && (
          <div role="alert" className="flex items-start gap-3 rounded-lg border border-danger/30 bg-danger/10 px-3.5 py-3 text-sm text-danger">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            {formError}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="invite-email" className="text-sm font-medium text-ink">
            Email
          </label>
          <Input id="invite-email" type="email" value={invite.email} readOnly aria-readonly="true" autoComplete="username" className="h-12 rounded-xl bg-panel-2 text-ink-dim" />
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-ink">Role</span>
          <RankBadge roleName={invite.role.name} />
        </div>

        <PasswordInput id="password" label="New Password" error={errors.password?.message} registration={register("password")} autoFocus />
        <PasswordInput id="confirmPassword" label="Confirm Password" error={errors.confirmPassword?.message} registration={register("confirmPassword")} />

        <PasswordRequirements value={password} />

        <Button type="submit" size="lg" className="h-12 w-full rounded-xl text-base" loading={isSubmitting}>
          {isSubmitting ? "Setting Password…" : "Set Password"}
        </Button>
      </form>
    </>
  );
}
