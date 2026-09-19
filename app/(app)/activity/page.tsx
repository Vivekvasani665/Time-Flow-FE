import type { Metadata } from "next";
import { Suspense } from "react";
import { ActivityList } from "@/components/activity/activity-list";
import { RequirePermission } from "@/components/auth/require-permission";

export const metadata: Metadata = { title: "Activity Logs" };

export default function ActivityPage() {
  return (
    <RequirePermission permission="activity_logs.view">
      <Suspense>
        <ActivityList />
      </Suspense>
    </RequirePermission>
  );
}
