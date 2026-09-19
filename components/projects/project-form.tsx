"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { FolderKanban, Users } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { FormActions } from "@/components/forms/form-actions";
import { UserMultiSelect, UserSelect } from "@/components/forms/user-select";
import { Field, fieldA11y } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Panel } from "@/components/ui/panel";
import { Select } from "@/components/ui/select";
import { applyServerErrors } from "@/lib/form-errors";
import { PRIORITIES, PRIORITY, PROJECT_STATUS, PROJECT_STATUSES } from "@/lib/labels";
import type { ProjectInput, UserRef } from "@/types/api";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export const projectSchema = z
  .object({
    name: z.string().trim().min(2, "Name must be at least 2 characters").max(120, "Max 120 characters"),
    description: z.string().trim().max(5000, "Max 5000 characters"),
    status: z.enum(["PLANNING", "ACTIVE", "ON_HOLD", "COMPLETED", "ARCHIVED"]),
    priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
    startDate: z.string().regex(DATE, "Start date is required"),
    endDate: z.string().refine((v) => v === "" || DATE.test(v), "Invalid date"),
    managerId: z.string().min(1, "Select a project manager"),
    memberIds: z.array(z.string()),
  })
  .refine((v) => !v.endDate || v.endDate >= v.startDate, {
    path: ["endDate"],
    message: "End date must be on or after the start date",
  });

export type ProjectFormValues = z.infer<typeof projectSchema>;

const FIELDS = ["name", "description", "status", "priority", "startDate", "endDate", "managerId", "memberIds"] as const;

export function toProjectPayload(values: ProjectFormValues): ProjectInput {
  return {
    name: values.name.trim(),
    description: values.description.trim() || null,
    status: values.status,
    priority: values.priority,
    startDate: values.startDate,
    endDate: values.endDate || null,
    managerId: values.managerId,
    memberIds: values.memberIds.filter((id) => id !== values.managerId),
  };
}

type ProjectFormProps = {
  mode: "create" | "edit";
  defaultValues?: Partial<ProjectFormValues>;
  knownUsers?: UserRef[];
  onSubmit: (payload: ProjectInput) => Promise<void>;
};

export function ProjectForm({ mode, defaultValues, knownUsers = [], onSubmit }: ProjectFormProps) {
  const {
    register,
    control,
    handleSubmit,
    setError,
    watch,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: "",
      description: "",
      status: "PLANNING",
      priority: "MEDIUM",
      startDate: new Date().toISOString().slice(0, 10),
      endDate: "",
      managerId: "",
      memberIds: [],
      ...defaultValues,
    },
  });

  const managerId = watch("managerId");

  const submit = handleSubmit(async (values) => {
    try {
      await onSubmit(toProjectPayload(values));
    } catch (error) {
      applyServerErrors(error, setError, FIELDS);
    }
  });

  return (
    <form onSubmit={submit} noValidate className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
      <Panel title="Project details" icon={<FolderKanban />}>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Project name" htmlFor="name" error={errors.name?.message} required className="sm:col-span-2">
            <Input {...fieldA11y("name", errors.name?.message)} placeholder="Website Redesign" {...register("name")} />
          </Field>
          <Field label="Description" htmlFor="description" error={errors.description?.message} className="sm:col-span-2">
            <Textarea {...fieldA11y("description", errors.description?.message)} rows={4} placeholder="Objectives, scope, success criteria…" {...register("description")} />
          </Field>
          <Field label="Status" htmlFor="status" error={errors.status?.message}>
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <Select
                  id="status"
                  value={field.value}
                  onValueChange={(v) => v && field.onChange(v)}
                  options={PROJECT_STATUSES.map((s) => ({ value: s, label: PROJECT_STATUS[s].label }))}
                />
              )}
            />
          </Field>
          <Field label="Priority" htmlFor="priority" error={errors.priority?.message}>
            <Controller
              control={control}
              name="priority"
              render={({ field }) => (
                <Select
                  id="priority"
                  value={field.value}
                  onValueChange={(v) => v && field.onChange(v)}
                  options={PRIORITIES.map((p) => ({ value: p, label: PRIORITY[p].label }))}
                />
              )}
            />
          </Field>
          <Field label="Start date" htmlFor="startDate" error={errors.startDate?.message} required>
            <Input {...fieldA11y("startDate", errors.startDate?.message)} type="date" {...register("startDate")} />
          </Field>
          <Field label="End date" htmlFor="endDate" error={errors.endDate?.message}>
            <Input {...fieldA11y("endDate", errors.endDate?.message)} type="date" {...register("endDate")} />
          </Field>
        </div>
      </Panel>

      <Panel title="Team" icon={<Users />}>
        <div className="space-y-5">
          <Field label="Project manager" htmlFor="managerId" error={errors.managerId?.message} required>
            <Controller
              control={control}
              name="managerId"
              render={({ field }) => (
                <UserSelect
                  id="managerId"
                  value={field.value || undefined}
                  onChange={(v) => field.onChange(v ?? "")}
                  extra={knownUsers}
                  placeholder="Select manager"
                  invalid={Boolean(errors.managerId)}
                  describedBy={errors.managerId ? "managerId-error" : undefined}
                />
              )}
            />
          </Field>
          <Field label="Members" htmlFor="memberIds" error={errors.memberIds?.message} hint="The project manager is always included.">
            <Controller
              control={control}
              name="memberIds"
              render={({ field }) => (
                <UserMultiSelect id="memberIds" value={field.value} onChange={field.onChange} extra={knownUsers} excludeIds={managerId ? [managerId] : []} />
              )}
            />
          </Field>
        </div>
        <div className="mt-6">
          <FormActions submitting={isSubmitting} submitLabel={mode === "create" ? "Create project" : "Save changes"} disabled={mode === "edit" && !isDirty} />
        </div>
      </Panel>
    </form>
  );
}
