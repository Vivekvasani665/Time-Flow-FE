import type { Metadata } from "next";
import { RequirePermission } from "@/components/auth/require-permission";
import { UserDetail } from "@/components/users/user-detail";

export const metadata: Metadata = { title: "User details" };

export default async function UserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <RequirePermission permission="users.view">
      <UserDetail id={id} />
    </RequirePermission>
  );
}
