"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { useCreateProject, useProject, useUpdateProject } from "@/hooks/use-projects";
import { toDateInput } from "@/lib/utils";
import { ProjectForm } from "./project-form";

export function CreateProject() {
  const router = useRouter();
  const create = useCreateProject();
  return (
    <div className="space-y-6">
      <PageHeader kicker="Projects" title="Create project" description="Add the project details and choose who works on it." />
      <ProjectForm
        mode="create"
        onSubmit={async (payload) => {
          const project = await create.mutateAsync(payload);
          toast.success("Project created", { description: project.name });
          router.push(`/projects/${project.id}`);
        }}
      />
    </div>
  );
}

export function EditProject({ id }: { id: string }) {
  const router = useRouter();
  const query = useProject(id);
  const update = useUpdateProject(id);

  if (query.isLoading) return <PageSkeleton />;
  if (query.error || !query.data) return <ErrorState title="Project unavailable" message={query.error?.message} onRetry={() => void query.refetch()} />;
  const p = query.data;

  return (
    <div className="space-y-6">
      <PageHeader kicker="Projects" title={`Edit ${p.name}`} />
      <ProjectForm
        key={p.updatedAt}
        mode="edit"
        knownUsers={[p.manager, ...p.members]}
        defaultValues={{
          name: p.name,
          description: p.description ?? "",
          status: p.status,
          priority: p.priority,
          startDate: toDateInput(p.startDate),
          endDate: toDateInput(p.endDate),
          managerId: p.manager.id,
          memberIds: p.members.map((m) => m.id),
        }}
        onSubmit={async (payload) => {
          const updated = await update.mutateAsync(payload);
          toast.success("Project updated", { description: updated.name });
          router.push(`/projects/${id}`);
        }}
      />
    </div>
  );
}
