import { api, toQuery } from "@/lib/api/client";
import type { CreateUserInput, UpdateUserInput, User, UserListParams, UserRef, UserStatus } from "@/types/api";

export const usersService = {
  list: (params: UserListParams) => api.list<User>("/users", toQuery(params)),
  get: (id: string) => api.get<User>(`/users/${id}`),
  options: (search?: string) => api.get<UserRef[]>("/users/options", { search }),
  create: async (input: CreateUserInput) => (await api.post<User>("/users", input)).data,
  update: async (id: string, input: UpdateUserInput) => (await api.patch<User>(`/users/${id}`, input)).data,
  setStatus: async (id: string, status: UserStatus) =>
    (await api.patch<User>(`/users/${id}/status`, { status })).data,
  remove: async (id: string) => {
    await api.delete<null>(`/users/${id}`);
  },
  uploadAvatar: async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return (await api.post<{ url: string }>("/uploads/avatar", form)).data.url;
  },
};
