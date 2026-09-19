"use client";

import { KeySquare, Pencil } from "lucide-react";
import { useAuth, usePermissions } from "@/components/auth/auth-provider";
import { Avatar } from "@/components/ui/avatar";
import { Badge, RankBadge, UserStatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { DataRow, Panel } from "@/components/ui/panel";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/skeleton";
import { MODULE_LABELS, humanize } from "@/lib/labels";
import { formatDate, formatDateTime, fullName } from "@/lib/utils";

export function ProfileView() {
  const { user, isLoading } = useAuth();
  const { can } = usePermissions();
  if (isLoading || !user) return <PageSkeleton />;

  const grouped = user.permissions.reduce<Record<string, string[]>>((acc, key) => {
    const [module = key, action = ""] = key.split(".");
    (acc[module] ??= []).push(action);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <PageHeader
        title="My profile"
        description="Your account details and the permissions your role grants."
        actions={
          can("users.update") && (
            <ButtonLink href={`/users/${user.id}/edit`} variant="secondary" icon={<Pencil className="size-4" />}>
              Edit profile
            </ButtonLink>
          )
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
        <Panel title="Account">
          <div className="mb-5 flex items-center gap-4">
            <Avatar user={user} size="lg" />
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold text-ink">{fullName(user)}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <RankBadge roleName={user.role.name} />
                <UserStatusBadge status={user.status} />
              </div>
            </div>
          </div>
          <dl>
            <DataRow label="Email">{user.email}</DataRow>
            <DataRow label="Phone">{user.phone ?? "—"}</DataRow>
            <DataRow label="Last login">
              <span className="tabular text-sm">{formatDateTime(user.lastLoginAt)}</span>
            </DataRow>
            <DataRow label="Member since">
              <span className="tabular text-sm">{formatDate(user.createdAt)}</span>
            </DataRow>
          </dl>
        </Panel>
        <Panel title="Permissions" subtitle={`${user.permissions.length} permissions from the ${user.role.name} role`} icon={<KeySquare />}>
          <ul className="divide-y divide-line">
            {Object.entries(grouped).map(([module, actions]) => (
              <li key={module} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center">
                <span className="w-32 shrink-0 text-sm font-medium text-ink">{MODULE_LABELS[module] ?? humanize(module)}</span>
                <span className="flex flex-wrap gap-1.5">
                  {actions.map((a) => (
                    <Badge key={a} tone="gray">
                      {humanize(a)}
                    </Badge>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
