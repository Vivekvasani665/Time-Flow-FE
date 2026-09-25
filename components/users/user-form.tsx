"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ImagePlus, Trash2, UserRound } from "lucide-react";
import { useRef } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { FormActions } from "@/components/forms/form-actions";
import { Field, fieldA11y } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Panel } from "@/components/ui/panel";
import { Select, type SelectOption } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { useUploadAvatar } from "@/hooks/use-users";
import { applyServerErrors } from "@/lib/form-errors";
import type { CreateUserInput, UpdateUserInput, UserStatus } from "@/types/api";
import { notifyError } from "@/lib/notify";

const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,128}$/;
const PHONE_RULE = /^\+?[0-9\s\-().]{7,20}$/;

const base = {
  firstName: z.string().trim().min(1, "First name is required").max(80, "Max 80 characters"),
  lastName: z.string().trim().min(1, "Last name is required").max(80, "Max 80 characters"),
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address").max(254),
  phone: z
    .string()
    .trim()
    .refine((v) => v === "" || PHONE_RULE.test(v), "Enter a valid phone number"),
  roleId: z.string().min(1, "Select a role"),
  status: z.enum(["ACTIVE", "INACTIVE", "PENDING"]),
  avatarUrl: z.string().nullable(),
};

export const createUserSchema = z.object({
  ...base,
  password: z.string().regex(PASSWORD_RULE, "Min 8 characters with at least one letter and one number"),
});

export const editUserSchema = z.object({
  ...base,
  password: z.string().refine((v) => v === "" || PASSWORD_RULE.test(v), "Min 8 characters with at least one letter and one number"),
});

export type UserFormValues = z.infer<typeof createUserSchema>;

const FIELDS = ["firstName", "lastName", "email", "phone", "password", "roleId", "status", "avatarUrl"] as const;

const STATUS_OPTIONS: SelectOption[] = [
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
];

type UserFormProps = {
  mode: "create" | "edit";
  roleOptions: SelectOption[];
  defaultValues?: Partial<UserFormValues>;
  /** Disable role/status editing (e.g. editing yourself). */
  lockAccess?: boolean;
  onSubmit: (payload: CreateUserInput | UpdateUserInput) => Promise<void>;
};

export function toUserPayload(values: UserFormValues, mode: "create" | "edit"): CreateUserInput | UpdateUserInput {
  const payload: UpdateUserInput = {
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
    email: values.email.trim().toLowerCase(),
    phone: values.phone.trim() || null,
    roleId: values.roleId,
    avatarUrl: values.avatarUrl,
  };
  // PENDING is only ever set by the signup flow; the API refuses it, so an untouched pending status is left out.
  if (values.status !== "PENDING") payload.status = values.status;
  if (mode === "create" || values.password) payload.password = values.password;
  return payload;
}

export function UserForm({ mode, roleOptions, defaultValues, lockAccess, onSubmit }: UserFormProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const upload = useUploadAvatar();
  const {
    register,
    control,
    handleSubmit,
    setError,
    setValue,
    watch,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<UserFormValues>({
    resolver: zodResolver(mode === "create" ? createUserSchema : editUserSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      password: "",
      roleId: "",
      status: "ACTIVE" as UserStatus,
      avatarUrl: null,
      ...defaultValues,
    },
  });

  const avatarUrl = watch("avatarUrl");
  const firstName = watch("firstName");
  const lastName = watch("lastName");

  const submit = handleSubmit(async (values) => {
    try {
      await onSubmit(toUserPayload(values, mode));
    } catch (error) {
      applyServerErrors(error, setError, FIELDS);
    }
  });

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      toast.error("Unsupported image", { description: "Use PNG, JPEG or WebP." });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image too large", { description: "Maximum size is 2 MB." });
      return;
    }
    try {
      const url = await upload.mutateAsync(file);
      setValue("avatarUrl", url, { shouldDirty: true });
    } catch (error) {
      notifyError(error, { title: "Upload failed" });
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <form onSubmit={submit} noValidate className="grid gap-6 xl:grid-cols-[320px_1fr]">
      <Panel title="Profile photo" className="h-fit">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="relative size-28 overflow-hidden rounded-full border border-line bg-panel-3">
            <div className="flex size-full items-center justify-center overflow-hidden rounded-full">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- served via API proxy
                <img src={avatarUrl} alt="Avatar preview" className="size-full object-cover" />
              ) : (
                <span className="text-3xl font-semibold text-ink-dim">
                  {`${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || "?"}
                </span>
              )}
            </div>
            {upload.isPending && (
              <div className="absolute inset-0 flex items-center justify-center bg-panel/70 text-ink-dim">
                <Spinner />
              </div>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            id="avatar-file"
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
          <div className="flex gap-2">
            <label
              htmlFor="avatar-file"
              className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-line-bright bg-panel px-3 text-[0.8125rem] font-medium text-ink shadow-sm transition-colors hover:bg-panel-2"
            >
              <ImagePlus className="size-3.5" /> Upload
            </label>
            {avatarUrl && (
              <button
                type="button"
                onClick={() => setValue("avatarUrl", null, { shouldDirty: true })}
                className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-line-bright bg-panel px-3 text-[0.8125rem] font-medium text-danger shadow-sm transition-colors hover:bg-danger/5"
              >
                <Trash2 className="size-3.5" /> Remove
              </button>
            )}
          </div>
          <p className="text-xs text-ink-mute">PNG, JPEG or WebP · max 2 MB</p>
        </div>
      </Panel>

      <Panel title={mode === "create" ? "User details" : "Edit details"} icon={<UserRound />}>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="First name" htmlFor="firstName" error={errors.firstName?.message} required>
            <Input {...fieldA11y("firstName", errors.firstName?.message)} autoComplete="given-name" {...register("firstName")} />
          </Field>
          <Field label="Last name" htmlFor="lastName" error={errors.lastName?.message} required>
            <Input {...fieldA11y("lastName", errors.lastName?.message)} autoComplete="family-name" {...register("lastName")} />
          </Field>
          <Field label="Email" htmlFor="email" error={errors.email?.message} required>
            <Input {...fieldA11y("email", errors.email?.message)} type="email" autoComplete="off" {...register("email")} />
          </Field>
          <Field label="Phone" htmlFor="phone" error={errors.phone?.message}>
            <Input {...fieldA11y("phone", errors.phone?.message)} type="tel" placeholder="+1 555 010 2000" {...register("phone")} />
          </Field>
          <Field
            label={mode === "create" ? "Password" : "New password"}
            htmlFor="password"
            error={errors.password?.message}
            hint={mode === "edit" ? "Leave blank to keep the current password." : "Min 8 characters, letters and numbers."}
            required={mode === "create"}
          >
            <Input {...fieldA11y("password", errors.password?.message)} type="password" autoComplete="new-password" {...register("password")} />
          </Field>
          <Field label="Role" htmlFor="roleId" error={errors.roleId?.message} required>
            <Controller
              control={control}
              name="roleId"
              render={({ field }) => (
                <Select
                  id="roleId"
                  value={field.value || undefined}
                  onValueChange={(v) => field.onChange(v ?? "")}
                  options={roleOptions}
                  placeholder="Select role"
                  disabled={lockAccess}
                  aria-invalid={errors.roleId ? true : undefined}
                  aria-describedby={errors.roleId ? "roleId-error" : undefined}
                />
              )}
            />
          </Field>
          <Field label="Status" htmlFor="status" error={errors.status?.message}>
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <Select
                  id="status"
                  value={field.value}
                  onValueChange={(v) => field.onChange(v ?? "ACTIVE")}
                  options={
                    defaultValues?.status === "PENDING" ? [...STATUS_OPTIONS, { value: "PENDING", label: "Pending verification" }] : STATUS_OPTIONS
                  }
                  disabled={lockAccess}
                />
              )}
            />
          </Field>
        </div>
        <div className="mt-6">
          <FormActions
            submitting={isSubmitting}
            submitLabel={mode === "create" ? "Create user" : "Save changes"}
            disabled={mode === "edit" && !isDirty}
          />
        </div>
      </Panel>
    </form>
  );
}
