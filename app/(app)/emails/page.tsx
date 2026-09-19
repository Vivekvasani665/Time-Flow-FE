import type { Metadata } from "next";
import { Suspense } from "react";
import { RequirePermission } from "@/components/auth/require-permission";
import { Mailbox } from "@/components/emails/mailbox";

export const metadata: Metadata = { title: "Mailbox" };

export default function EmailsPage() {
  return (
    <RequirePermission permission="emails.view">
      <Suspense>
        <Mailbox />
      </Suspense>
    </RequirePermission>
  );
}
