"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { KeySquare, ShieldCheck } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { FormActions } from "@/components/forms/form-actions";
import { Field, fieldA11y } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Panel } from "@/components/ui/panel";
import { applyServerErrors } from "@/lib/form-errors";
import type { Permission, RoleInput } from "@/types/api";
import { PermissionMatrix } from "./permission-matrix";

export const roleSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(60, "Max 60 characters"),
  description: z.string().trim().max(255, "Max 255 characters"),
  permissions: z.array(z.string()),
});

export type RoleFormValues = z.infer<typeof roleSchema>;

type RoleFormProps = {
  catalog: Permission[];
  defaultValues?: Partial<RoleFormValues>;
  readOnly?: boolean;
  lockName?: boolean;
  lockPermissions?: boolean;
  grantable?: Set<string>;
  submitLabel: string;
  onSubmit: (payload: RoleInput) => Promise<void>;
};

export function RoleForm({ catalog, defaultValues, readOnly, lockName, lockPermissions, grantable, submitLabel, onSubmit }: RoleFormProps) {
  const {
    register,
    control,
    handleSubmit,
    setError,
    watch,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<RoleFormValues>({
    resolver: zodResolver(roleSchema),
    defaultValues: { name: "", description: "", permissions: [], ...defaultValues },
  });

  const count = watch("permissions").length;

  const submit = handleSubmit(async (values) => {
    try {
      await onSubmit({ name: values.name.trim(), description: values.description.trim() || null, permissions: values.permissions });
    } catch (error) {
      applyServerErrors(error, setError, ["name", "description", "permissions"]);
    }
  });

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      <Panel title="Role details" icon={<ShieldCheck />}>
        <div className="grid gap-5 md:grid-cols-[1fr_2fr]">
          <Field label="Role name" htmlFor="name" error={errors.name?.message} required>
            <Input {...fieldA11y("name", errors.name?.message)} placeholder="Project Manager" disabled={readOnly || lockName} {...register("name")} />
          </Field>
          <Field label="Description" htmlFor="description" error={errors.description?.message}>
            <Textarea {...fieldA11y("description", errors.description?.message)} className="min-h-10" rows={1} disabled={readOnly} placeholder="What this role is responsible for" {...register("description")} />
          </Field>
        </div>
      </Panel>

      <Panel
        title="Permissions"
        subtitle={lockPermissions ? "Super Admin permissions are fixed" : "Choose what this role can access in each module"}
        icon={<KeySquare />}
        bodyClassName="p-0"
        actions={<span className="tabular text-xs text-ink-mute">{count} selected</span>}
      >
        <Controller
          control={control}
          name="permissions"
          render={({ field }) => (
            <PermissionMatrix
              catalog={catalog}
              value={field.value}
              onChange={field.onChange}
              readOnly={readOnly || lockPermissions}
              grantable={grantable}
            />
          )}
        />
        {errors.permissions?.message && <p className="px-5 py-3 text-sm text-danger">{errors.permissions.message}</p>}
      </Panel>

      {!readOnly && (
        <FormActions submitting={isSubmitting} submitLabel={submitLabel} disabled={Boolean(defaultValues) && !isDirty} />
      )}
    </form>
  );
}
