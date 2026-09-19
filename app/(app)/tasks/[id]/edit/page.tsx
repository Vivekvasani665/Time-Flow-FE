import type { Metadata } from "next";
import { RequirePermission } from "@/components/auth/require-permission";
import { EditTask } from "@/components/tasks/task-editor";

export const metadata: Metadata = { title: "Edit task" };

export default async function EditTaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <RequirePermission permission="tasks.update">
      <EditTask id={id} />
    </RequirePermission>
  );
}
