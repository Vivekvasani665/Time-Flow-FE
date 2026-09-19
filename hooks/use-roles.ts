"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { rolesService } from "@/services/roles.service";
import type { ListParams, RoleInput } from "@/types/api";

export function useRoles(params: ListParams, enabled = true) {
  return useQuery({
    queryKey: queryKeys.roles.list(params),
    queryFn: () => rolesService.list(params),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useRole(id: string) {
  return useQuery({ queryKey: queryKeys.roles.detail(id), queryFn: () => rolesService.get(id) });
}

export function useRoleUsers(id: string, params: ListParams) {
  return useQuery({
    queryKey: queryKeys.roles.users(id, params),
    queryFn: () => rolesService.users(id, params),
    placeholderData: keepPreviousData,
  });
}

export function usePermissionCatalog() {
  return useQuery({ queryKey: queryKeys.roles.permissions, queryFn: rolesService.permissions, staleTime: 5 * 60_000 });
}

function useInvalidateRoles() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: queryKeys.roles.all });
    // Editing a role may change the current user's own permissions.
    void qc.invalidateQueries({ queryKey: queryKeys.me });
  };
}

export function useCreateRole() {
  const invalidate = useInvalidateRoles();
  return useMutation({ mutationFn: (input: RoleInput) => rolesService.create(input), onSuccess: invalidate });
}

export function useUpdateRole(id: string) {
  const invalidate = useInvalidateRoles();
  return useMutation({ mutationFn: (input: Partial<RoleInput>) => rolesService.update(id, input), onSuccess: invalidate });
}

export function useDeleteRole() {
  const invalidate = useInvalidateRoles();
  return useMutation({ mutationFn: (id: string) => rolesService.remove(id), onSuccess: invalidate });
}
