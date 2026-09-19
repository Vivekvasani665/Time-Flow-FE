import type { Metadata } from "next";
import { Suspense } from "react";
import { RequirePermission } from "@/components/auth/require-permission";
import { ProjectsList } from "@/components/projects/projects-list";

export const metadata: Metadata = { title: "Projects" };

export default function ProjectsPage() {
  return (
    <RequirePermission permission="projects.view">
      <Suspense>
        <ProjectsList />
      </Suspense>
    </RequirePermission>
  );
}
