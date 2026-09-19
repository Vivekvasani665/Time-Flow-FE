import type { Metadata } from "next";
import { RequirePermission } from "@/components/auth/require-permission";
import { EditProject } from "@/components/projects/project-editor";

export const metadata: Metadata = { title: "Edit project" };

export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <RequirePermission permission="projects.update">
      <EditProject id={id} />
    </RequirePermission>
  );
}
