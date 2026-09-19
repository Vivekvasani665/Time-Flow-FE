import type { Metadata } from "next";
import { RequirePermission } from "@/components/auth/require-permission";
import { CreateProject } from "@/components/projects/project-editor";

export const metadata: Metadata = { title: "Create project" };

export default function NewProjectPage() {
  return (
    <RequirePermission permission="projects.create">
      <CreateProject />
    </RequirePermission>
  );
}
