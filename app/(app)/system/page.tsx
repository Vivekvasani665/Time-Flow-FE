import type { Metadata } from "next";
import { RequirePermission } from "@/components/auth/require-permission";
import { SystemView } from "@/components/system/system-view";

export const metadata: Metadata = { title: "System" };

export default function SystemPage() {
  return (
    <RequirePermission permission="queues.view">
      <SystemView />
    </RequirePermission>
  );
}
