"use client";

import type { ReactNode } from "react";
import { usePermissions } from "./auth-provider";

type CanProps = {
  /** Single permission, or several (any-of by default). */
  permission: string | string[];
  mode?: "any" | "all";
  fallback?: ReactNode;
  children: ReactNode;
};

export function Can({ permission, mode = "any", fallback = null, children }: CanProps) {
  const { canAny, canAll } = usePermissions();
  const keys = Array.isArray(permission) ? permission : [permission];
  const allowed = mode === "all" ? canAll(...keys) : canAny(...keys);
  return <>{allowed ? children : fallback}</>;
}
