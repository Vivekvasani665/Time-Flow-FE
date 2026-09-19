import type { Metadata } from "next";
import { Suspense } from "react";
import { RequirePermission } from "@/components/auth/require-permission";
import { UsersList } from "@/components/users/users-list";

export const metadata: Metadata = { title: "Users" };

export default function UsersPage() {
  return (
    <RequirePermission permission="users.view">
      <Suspense>
        <UsersList />
      </Suspense>
    </RequirePermission>
  );
}
