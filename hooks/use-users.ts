"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { usersService } from "@/services/users.service";
import type { CreateUserInput, UpdateUserInput, UserListParams, UserStatus } from "@/types/api";

export function useUsers(params: UserListParams) {
  return useQuery({ queryKey: queryKeys.users.list(params), queryFn: () => usersService.list(params), placeholderData: keepPreviousData });
}

export function useUser(id: string) {
  return useQuery({ queryKey: queryKeys.users.detail(id), queryFn: () => usersService.get(id) });
}

export function useUserOptions(search = "", enabled = true) {
  return useQuery({
    queryKey: queryKeys.users.options(search),
    queryFn: () => usersService.options(search || undefined),
    staleTime: 60_000,
    enabled,
  });
}

function useInvalidateUsers() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: queryKeys.users.all });
    void qc.invalidateQueries({ queryKey: queryKeys.roles.all });
    void qc.invalidateQueries({ queryKey: queryKeys.dashboard });
  };
}

export function useCreateUser() {
  const invalidate = useInvalidateUsers();
  return useMutation({ mutationFn: (input: CreateUserInput) => usersService.create(input), onSuccess: invalidate });
}

export function useUpdateUser(id: string) {
  const invalidate = useInvalidateUsers();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateUserInput) => usersService.update(id, input),
    onSuccess: (user) => {
      qc.setQueryData(queryKeys.users.detail(id), user);
      invalidate();
      void qc.invalidateQueries({ queryKey: queryKeys.me });
    },
  });
}

export function useSetUserStatus() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: UserStatus }) => usersService.setStatus(id, status),
    onSuccess: invalidate,
  });
}

export function useDeleteUser() {
  const invalidate = useInvalidateUsers();
  return useMutation({ mutationFn: (id: string) => usersService.remove(id), onSuccess: invalidate });
}

export function useUploadAvatar() {
  return useMutation({ mutationFn: (file: File) => usersService.uploadAvatar(file) });
}
