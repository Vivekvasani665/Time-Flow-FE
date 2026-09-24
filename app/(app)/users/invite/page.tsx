import type { Metadata } from "next";
import { RequireSuperAdmin } from "@/components/auth/require-permission";
import { InviteUser } from "@/components/invitations/invite-user";

export const metadata: Metadata = { title: "Invite user" };

export default function InviteUserPage() {
  return (
    <RequireSuperAdmin>
      <InviteUser />
    </RequireSuperAdmin>
  );
}
