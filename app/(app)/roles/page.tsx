import type { Metadata } from "next";
import { Suspense } from "react";
import { RequirePermission } from "@/components/auth/require-permission";
import { RolesList } from "@/components/roles/roles-list";

export const metadata: Metadata = { title: "Roles" };

export default function RolesPage() {
  return (
    <RequirePermission permission="roles.view">
      <Suspense>
        <RolesList />
      </Suspense>
    </RequirePermission>
  );
}
