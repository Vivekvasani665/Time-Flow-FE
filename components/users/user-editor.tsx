"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuth, usePermissions } from "@/components/auth/auth-provider";
import { PageSkeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { PageHeader } from "@/components/ui/page-header";
import { useRoles } from "@/hooks/use-roles";
import { useCreateUser, useUpdateUser, useUser } from "@/hooks/use-users";
import { fullName } from "@/lib/utils";
import type { CreateUserInput, User } from "@/types/api";
import { UserForm } from "./user-form";

function useRoleOptions(current?: User["role"]) {
  const { can } = usePermissions();
  const roles = useRoles({ limit: 100, sortBy: "name", sortOrder: "asc" }, can("roles.view"));
  const options = (roles.data?.items ?? []).map((r) => ({ value: r.id, label: r.name }));
  if (current && !options.some((o) => o.value === current.id)) options.unshift({ value: current.id, label: current.name });
  return options;
}

export function CreateUser() {
  const router = useRouter();
  const create = useCreateUser();
  const roleOptions = useRoleOptions();

  return (
    <div className="space-y-6">
      <PageHeader title="Create user" description="Add a new team member. A welcome email is sent automatically." />
      <UserForm
        mode="create"
        roleOptions={roleOptions}
        onSubmit={async (payload) => {
          const user = await create.mutateAsync(payload as CreateUserInput);
          toast.success("User created", { description: `${fullName(user)} was added to the team.` });
          router.push(`/users/${user.id}`);
        }}
      />
    </div>
  );
}

export function EditUser({ id }: { id: string }) {
  const router = useRouter();
  const { user: me } = useAuth();
  const query = useUser(id);
  const update = useUpdateUser(id);
  const roleOptions = useRoleOptions(query.data?.role);

  if (query.isLoading) return <PageSkeleton />;
  if (query.error || !query.data) {
    return <ErrorState title="User unavailable" error={query.error} onRetry={() => query.refetch()} />;
  }
  const user = query.data;

  return (
    <div className="space-y-6">
      <PageHeader kicker="Users" title={`Edit ${fullName(user)}`} description={user.email} />
      <UserForm
        key={user.updatedAt}
        mode="edit"
        roleOptions={roleOptions}
        lockAccess={me?.id === user.id}
        defaultValues={{
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone ?? "",
          roleId: user.role.id,
          status: user.status,
          avatarUrl: user.avatarUrl,
        }}
        onSubmit={async (payload) => {
          const updated = await update.mutateAsync(payload);
          toast.success("Changes saved", { description: fullName(updated) });
          router.push(`/users/${id}`);
        }}
      />
    </div>
  );
}
