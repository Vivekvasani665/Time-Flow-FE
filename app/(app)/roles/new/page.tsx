import type { Metadata } from "next";
import { RequirePermission } from "@/components/auth/require-permission";
import { CreateRole } from "@/components/roles/role-editor";

export const metadata: Metadata = { title: "Create role" };

export default function NewRolePage() {
  return (
    <RequirePermission permission="roles.create">
      <CreateRole />
    </RequirePermission>
  );
}
