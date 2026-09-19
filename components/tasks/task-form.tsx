"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ListChecks, SlidersHorizontal } from "lucide-react";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { FormActions } from "@/components/forms/form-actions";
import { UserSelect } from "@/components/forms/user-select";
import { Field, fieldA11y } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Panel } from "@/components/ui/panel";
import { Select } from "@/components/ui/select";
import { useProject, useProjects } from "@/hooks/use-projects";
import { applyServerErrors } from "@/lib/form-errors";
import { PRIORITIES, PRIORITY, TASK_STATUS, TASK_STATUSES } from "@/lib/labels";
import type { TaskInput, UserRef } from "@/types/api";

export const taskSchema = z.object({
  title: z.string().trim().min(2, "Title must be at least 2 characters").max(160, "Max 160 characters"),
  description: z.string().trim().max(5000, "Max 5000 characters"),
  projectId: z.string().min(1, "Select a project"),
  assigneeId: z.string(),
  status: z.enum(["TODO", "IN_PROGRESS", "REVIEW", "COMPLETED"]),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  dueDate: z.string().refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "Invalid date"),
});

export type TaskFormValues = z.infer<typeof taskSchema>;

const FIELDS = ["title", "description", "projectId", "assigneeId", "status", "priority", "dueDate"] as const;

type TaskFormProps = {
  mode: "create" | "edit";
  defaultValues?: Partial<TaskFormValues>;
  knownProject?: { id: string; name: string };
  knownAssignee?: UserRef | null;
  /** Only the status can change (assignee without manage rights). */
  statusOnly?: boolean;
  onSubmit: (payload: Partial<TaskInput>) => Promise<void>;
};

export function TaskForm({ mode, defaultValues, knownProject, knownAssignee, statusOnly, onSubmit }: TaskFormProps) {
  const {
    register,
    control,
    handleSubmit,
    setError,
    setValue,
    watch,
    formState: { errors, isSubmitting, isDirty, dirtyFields },
  } = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: "",
      description: "",
      projectId: "",
      assigneeId: "",
      status: "TODO",
      priority: "MEDIUM",
      dueDate: "",
      ...defaultValues,
    },
  });

  const projectId = watch("projectId");
  const assigneeId = watch("assigneeId");
  const projects = useProjects({ limit: 100, sortBy: "name", sortOrder: "asc" }, !statusOnly);
  const project = useProject(projectId, !statusOnly);
  const projectMembers: UserRef[] = project.data ? [project.data.manager, ...project.data.members] : [];

  const projectOptions = (projects.data?.items ?? []).map((p) => ({ value: p.id, label: p.name }));
  if (knownProject && !projectOptions.some((o) => o.value === knownProject.id)) {
    projectOptions.unshift({ value: knownProject.id, label: knownProject.name });
  }

  // Assignee must belong to the selected project's team; clear it when it no longer does.
  useEffect(() => {
    if (!project.data || !assigneeId) return;
    if (!projectMembers.some((u) => u.id === assigneeId)) setValue("assigneeId", "", { shouldDirty: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.data]);

  const submit = handleSubmit(async (values) => {
    const full: TaskInput = {
      title: values.title.trim(),
      description: values.description.trim() || null,
      projectId: values.projectId,
      assigneeId: values.assigneeId || null,
      status: values.status,
      priority: values.priority,
      dueDate: values.dueDate || null,
    };
    let payload: Partial<TaskInput> = full;
    if (statusOnly) payload = { status: values.status };
    else if (mode === "edit") {
      // Send only changed fields so status transitions are logged precisely.
      payload = Object.fromEntries(
        Object.entries(full).filter(([key]) => dirtyFields[key as keyof TaskFormValues]),
      ) as Partial<TaskInput>;
    }
    try {
      await onSubmit(payload);
    } catch (error) {
      applyServerErrors(error, setError, FIELDS);
    }
  });

  return (
    <form onSubmit={submit} noValidate className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
      <Panel title="Task details" icon={<ListChecks />} subtitle={statusOnly ? "You can only update the status of this task" : undefined}>
        <div className="grid gap-5">
          <Field label="Title" htmlFor="title" error={errors.title?.message} required>
            <Input {...fieldA11y("title", errors.title?.message)} disabled={statusOnly} placeholder="Design landing page hero" {...register("title")} />
          </Field>
          <Field label="Description" htmlFor="description" error={errors.description?.message}>
            <Textarea {...fieldA11y("description", errors.description?.message)} disabled={statusOnly} rows={6} placeholder="Acceptance criteria, links, notes…" {...register("description")} />
          </Field>
        </div>
      </Panel>

      <Panel title="Properties" icon={<SlidersHorizontal />}>
        <div className="grid gap-5">
          <Field label="Project" htmlFor="projectId" error={errors.projectId?.message} required>
            <Controller
              control={control}
              name="projectId"
              render={({ field }) => (
                <Select
                  id="projectId"
                  value={field.value || undefined}
                  onValueChange={(v) => field.onChange(v ?? "")}
                  options={projectOptions}
                  placeholder={projects.isLoading ? "Loading projects…" : "Select project"}
                  disabled={statusOnly || mode === "edit"}
                  aria-invalid={errors.projectId ? true : undefined}
                  aria-describedby={errors.projectId ? "projectId-error" : undefined}
                />
              )}
            />
          </Field>
          <Field label="Assignee" htmlFor="assigneeId" error={errors.assigneeId?.message} hint={!projectId ? "Pick a project first." : "Only members of the project can be assigned."}>
            <Controller
              control={control}
              name="assigneeId"
              render={({ field }) => (
                <UserSelect
                  id="assigneeId"
                  value={field.value || undefined}
                  onChange={(v) => field.onChange(v ?? "")}
                  restrictTo={projectMembers}
                  extra={knownAssignee ? [knownAssignee] : []}
                  allLabel="Unassigned"
                  placeholder="Unassigned"
                  disabled={statusOnly || !projectId}
                />
              )}
            />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Status" htmlFor="status" error={errors.status?.message}>
              <Controller
                control={control}
                name="status"
                render={({ field }) => (
                  <Select id="status" value={field.value} onValueChange={(v) => v && field.onChange(v)} options={TASK_STATUSES.map((s) => ({ value: s, label: TASK_STATUS[s].label }))} />
                )}
              />
            </Field>
            <Field label="Priority" htmlFor="priority" error={errors.priority?.message}>
              <Controller
                control={control}
                name="priority"
                render={({ field }) => (
                  <Select id="priority" value={field.value} disabled={statusOnly} onValueChange={(v) => v && field.onChange(v)} options={PRIORITIES.map((p) => ({ value: p, label: PRIORITY[p].label }))} />
                )}
              />
            </Field>
          </div>
          <Field label="Due date" htmlFor="dueDate" error={errors.dueDate?.message}>
            <Input {...fieldA11y("dueDate", errors.dueDate?.message)} type="date" disabled={statusOnly} {...register("dueDate")} />
          </Field>
        </div>
        <div className="mt-6">
          <FormActions submitting={isSubmitting} submitLabel={mode === "create" ? "Create task" : "Save changes"} disabled={mode === "edit" && !isDirty} />
        </div>
      </Panel>
    </form>
  );
}
