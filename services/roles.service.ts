import { api, toQuery } from "@/lib/api/client";
import type { ListParams, Permission, Role, RoleInput, User } from "@/types/api";

export const rolesService = {
  list: (params: ListParams) => api.list<Role>("/roles", toQuery(params)),
  get: (id: string) => api.get<Role>(`/roles/${id}`),
  users: (id: string, params: ListParams) => api.list<User>(`/roles/${id}/users`, toQuery(params)),
  permissions: () => api.get<Permission[]>("/permissions"),
  create: async (input: RoleInput) => (await api.post<Role>("/roles", input)).data,
  update: async (id: string, input: Partial<RoleInput>) => (await api.patch<Role>(`/roles/${id}`, input)).data,
  remove: async (id: string) => {
    await api.delete<null>(`/roles/${id}`);
  },
};
