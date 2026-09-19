import type { Metadata } from "next";
import { Suspense } from "react";
import { RequirePermission } from "@/components/auth/require-permission";
import { TasksList } from "@/components/tasks/tasks-list";

export const metadata: Metadata = { title: "Tasks" };

export default function TasksPage() {
  return (
    <RequirePermission permission="tasks.view">
      <Suspense>
        <TasksList />
      </Suspense>
    </RequirePermission>
  );
}
