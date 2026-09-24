"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Link2, MailPlus } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, fieldA11y } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { Select } from "@/components/ui/select";
import { useCreateInvitation } from "@/hooks/use-invitations";
import { useRoles } from "@/hooks/use-roles";
import { isApiError } from "@/lib/api/client";
import type { CreatedInvitation } from "@/types/api";
import { InvitationLinkCard } from "./invitation-link-card";

export const inviteUserSchema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address").max(254),
  roleId: z.string().min(1, "Select a role"),
});

type InviteUserValues = z.infer<typeof inviteUserSchema>;

export function InviteUser() {
  const roles = useRoles({ limit: 100, sortBy: "name", sortOrder: "asc" });
  const create = useCreateInvitation();
  const [result, setResult] = useState<CreatedInvitation | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<InviteUserValues>({ resolver: zodResolver(inviteUserSchema), defaultValues: { email: "", roleId: "" } });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      setResult(await create.mutateAsync({ email: values.email.trim().toLowerCase(), roleId: values.roleId }));
    } catch (error) {
      if (!isApiError(error)) return setFormError("Unable to generate invitation. Please try again.");
      if (error.code === "USER_EMAIL_EXISTS") return setError("email", { type: "server", message: "User with this email already exists." }, { shouldFocus: true });
      if (error.code === "VALIDATION_ERROR") {
        const roleIssue = error.details.some((d) => d.path === "roleId");
        const emailIssue = error.details.find((d) => d.path === "email");
        if (roleIssue) setError("roleId", { type: "server", message: "Selected role is invalid." });
        if (emailIssue) setError("email", { type: "server", message: emailIssue.message });
        if (roleIssue || emailIssue) return;
      }
      // These carry messages written for the admin; anything else (5xx, unknown) gets a generic one.
      if (["RATE_LIMITED", "INVITATION_IN_PROGRESS", "FORBIDDEN", "NETWORK_ERROR"].includes(error.code)) return setFormError(error.message);
      setFormError("Unable to generate invitation. Please try again.");
    }
  });

  const inviteAnother = () => {
    reset();
    setResult(null);
    create.reset();
  };

  const roleOptions = (roles.data?.items ?? []).map((r) => ({ value: r.id, label: r.name }));

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        kicker="Users"
        title="Invite user"
        description="Generate a single-use link. The user opens it to set their own password — you never see it."
        actions={
          <ButtonLink href="/users" variant="secondary">
            Back to users
          </ButtonLink>
        }
      />

      {result ? (
        <InvitationLinkCard result={result} onInviteAnother={inviteAnother} />
      ) : (
        <Panel title="Invitation details" icon={<MailPlus />}>
          <form onSubmit={onSubmit} noValidate className="space-y-5">
            {formError && (
              <div role="alert" className="flex items-start gap-3 rounded-lg border border-danger/30 bg-danger/10 px-3.5 py-3 text-sm text-danger">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                {formError}
              </div>
            )}

            <Field label="Email Address" htmlFor="email" error={errors.email?.message} required>
              <Input {...fieldA11y("email", errors.email?.message)} type="email" autoComplete="off" placeholder="user@example.com" autoFocus {...register("email")} />
            </Field>

            <Field
              label="Role"
              htmlFor="roleId"
              error={errors.roleId?.message ?? (roles.isError ? "Could not load roles. Refresh to try again." : undefined)}
              required
            >
              <Controller
                control={control}
                name="roleId"
                render={({ field }) => (
                  <Select
                    id="roleId"
                    value={field.value || undefined}
                    onValueChange={(v) => field.onChange(v ?? "")}
                    options={roleOptions}
                    placeholder={roles.isLoading ? "Loading roles…" : "Select Role"}
                    disabled={roles.isLoading || roles.isError}
                    aria-invalid={errors.roleId ? true : undefined}
                    aria-describedby={errors.roleId ? "roleId-error" : undefined}
                  />
                )}
              />
            </Field>

            <div className="flex justify-end border-t border-line pt-5">
              <Button type="submit" loading={isSubmitting} icon={<Link2 className="size-4" />} className="w-full sm:w-auto">
                {isSubmitting ? "Generating…" : "Generate Invitation Link"}
              </Button>
            </div>
          </form>
        </Panel>
      )}
    </div>
  );
}
