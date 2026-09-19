import type { Metadata } from "next";
import { RequirePermission } from "@/components/auth/require-permission";
import { TaskDetail } from "@/components/tasks/task-detail";

export const metadata: Metadata = { title: "Task details" };

export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <RequirePermission permission="tasks.view">
      <TaskDetail id={id} />
    </RequirePermission>
  );
}
