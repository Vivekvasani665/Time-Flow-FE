import type { Metadata } from "next";
import { RequirePermission } from "@/components/auth/require-permission";
import { CreateUser } from "@/components/users/user-editor";

export const metadata: Metadata = { title: "Create user" };

export default function NewUserPage() {
  return (
    <RequirePermission permission="users.create">
      <CreateUser />
    </RequirePermission>
  );
}
