"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { projectsService } from "@/services/projects.service";
import type { ProjectInput, ProjectListParams } from "@/types/api";

export function useProjects(params: ProjectListParams, enabled = true) {
  return useQuery({
    queryKey: queryKeys.projects.list(params),
    queryFn: () => projectsService.list(params),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useProject(id: string, enabled = true) {
  return useQuery({ queryKey: queryKeys.projects.detail(id), queryFn: () => projectsService.get(id), enabled: enabled && Boolean(id) });
}

function useInvalidateProjects() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: queryKeys.projects.all });
    void qc.invalidateQueries({ queryKey: queryKeys.tasks.all });
    void qc.invalidateQueries({ queryKey: queryKeys.dashboard });
  };
}

export function useCreateProject() {
  const invalidate = useInvalidateProjects();
  return useMutation({ mutationFn: (input: ProjectInput) => projectsService.create(input), onSuccess: invalidate });
}

export function useUpdateProject(id: string) {
  const invalidate = useInvalidateProjects();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<ProjectInput>) => projectsService.update(id, input),
    onSuccess: (project) => {
      qc.setQueryData(queryKeys.projects.detail(id), project);
      invalidate();
    },
  });
}

export function useDeleteProject() {
  const invalidate = useInvalidateProjects();
  return useMutation({ mutationFn: (id: string) => projectsService.remove(id), onSuccess: invalidate });
}
