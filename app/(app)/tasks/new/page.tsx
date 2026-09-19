import type { Metadata } from "next";
import { Suspense } from "react";
import { RequirePermission } from "@/components/auth/require-permission";
import { CreateTask } from "@/components/tasks/task-editor";

export const metadata: Metadata = { title: "Create task" };

export default function NewTaskPage() {
  return (
    <RequirePermission permission="tasks.create">
      <Suspense>
        <CreateTask />
      </Suspense>
    </RequirePermission>
  );
}
