"use client";

import type { ReactNode } from "react";
import { AccessDenied } from "@/components/ui/states";
import { PageSkeleton } from "@/components/ui/skeleton";
import { useAuth, usePermissions } from "./auth-provider";

/** Route-level guard: renders a styled 403 screen when the permission is missing. */
export function RequirePermission({ permission, children }: { permission: string; children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const { can } = usePermissions();
  if (isLoading && !user) return <PageSkeleton />;
  if (!can(permission)) return <AccessDenied permission={permission} />;
  return <>{children}</>;
}
