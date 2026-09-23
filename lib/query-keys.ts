import type { EmailListParams } from "@/services/email.service";
import type { ActivityListParams, JobState, ListParams, ProjectListParams, TaskListParams, UserListParams } from "@/types/api";

export const queryKeys = {
  me: ["auth", "me"] as const,
  dashboard: ["dashboard"] as const,
  users: {
    all: ["users"] as const,
    list: (params: UserListParams) => ["users", "list", params] as const,
    detail: (id: string) => ["users", "detail", id] as const,
    options: (search: string) => ["users", "options", search] as const,
  },
  passwordResets: {
    all: ["password-resets"] as const,
    latest: (userIds: string[]) => ["password-resets", "latest", userIds] as const,
    user: (userId: string) => ["password-resets", "user", userId] as const,
  },
  roles: {
    all: ["roles"] as const,
    list: (params: ListParams) => ["roles", "list", params] as const,
    detail: (id: string) => ["roles", "detail", id] as const,
    users: (id: string, params: ListParams) => ["roles", "users", id, params] as const,
    permissions: ["permissions"] as const,
  },
  projects: {
    all: ["projects"] as const,
    list: (params: ProjectListParams) => ["projects", "list", params] as const,
    detail: (id: string) => ["projects", "detail", id] as const,
    stats: ["projects", "stats"] as const,
  },
  tasks: {
    all: ["tasks"] as const,
    list: (params: TaskListParams) => ["tasks", "list", params] as const,
    detail: (id: string) => ["tasks", "detail", id] as const,
  },
  activity: {
    all: ["activity"] as const,
    list: (params: ActivityListParams) => ["activity", "list", params] as const,
    stats: (params: ActivityListParams) => ["activity", "stats", params] as const,
  },
  notifications: ["notifications"] as const,
  sessions: ["auth", "sessions"] as const,
  mailSettings: ["mail-settings"] as const,
  emails: {
    all: ["emails"] as const,
    list: (params: EmailListParams) => ["emails", "list", params] as const,
    detail: (id: string) => ["emails", "detail", id] as const,
    stats: ["emails", "stats"] as const,
  },
  system: {
    queues: ["system", "queues"] as const,
    jobs: (name: string, state: JobState) => ["system", "jobs", name, state] as const,
  },
};
