import type { Metadata } from "next";
import { RequirePermission } from "@/components/auth/require-permission";
import { ProjectDetail } from "@/components/projects/project-detail";

export const metadata: Metadata = { title: "Project details" };

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <RequirePermission permission="projects.view">
      <ProjectDetail id={id} />
    </RequirePermission>
  );
}
