import type { Metadata } from "next";
import { RequirePermission } from "@/components/auth/require-permission";
import { EditUser } from "@/components/users/user-editor";

export const metadata: Metadata = { title: "Edit user" };

export default async function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <RequirePermission permission="users.update">
      <EditUser id={id} />
    </RequirePermission>
  );
}
