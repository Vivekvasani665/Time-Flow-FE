import type { Metadata } from "next";
import { RequirePermission } from "@/components/auth/require-permission";
import { RoleDetail } from "@/components/roles/role-editor";

export const metadata: Metadata = { title: "Role" };

export default async function RolePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <RequirePermission permission="roles.view">
      <RoleDetail id={id} />
    </RequirePermission>
  );
}
