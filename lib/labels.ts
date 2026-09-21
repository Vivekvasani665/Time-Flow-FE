import type { Priority, ProjectStatus, TaskStatus, UserStatus } from "@/types/api";

export type Tone = "cyan" | "violet" | "magenta" | "lime" | "amber" | "red" | "blue" | "gray";

export const PROJECT_STATUS: Record<ProjectStatus, { label: string; tone: Tone }> = {
  PLANNING: { label: "Planning", tone: "magenta" },
  ACTIVE: { label: "Active", tone: "cyan" },
  ON_HOLD: { label: "On hold", tone: "amber" },
  COMPLETED: { label: "Completed", tone: "lime" },
  ARCHIVED: { label: "Archived", tone: "gray" },
};

export const TASK_STATUS: Record<TaskStatus, { label: string; tone: Tone }> = {
  TODO: { label: "To do", tone: "gray" },
  IN_PROGRESS: { label: "In progress", tone: "cyan" },
  REVIEW: { label: "Review", tone: "violet" },
  COMPLETED: { label: "Completed", tone: "lime" },
};

export const PRIORITY: Record<Priority, { label: string; level: 1 | 2 | 3 | 4; tone: Tone }> = {
  LOW: { label: "Low", level: 1, tone: "blue" },
  MEDIUM: { label: "Medium", level: 2, tone: "cyan" },
  HIGH: { label: "High", level: 3, tone: "amber" },
  CRITICAL: { label: "Critical", level: 4, tone: "red" },
};

export const USER_STATUS: Record<UserStatus, { label: string; tone: Tone }> = {
  ACTIVE: { label: "Active", tone: "lime" },
  INACTIVE: { label: "Inactive", tone: "gray" },
};

export const PROJECT_STATUSES = Object.keys(PROJECT_STATUS) as ProjectStatus[];
export const TASK_STATUSES = Object.keys(TASK_STATUS) as TaskStatus[];
export const PRIORITIES = Object.keys(PRIORITY) as Priority[];

/** Role access level, most to least privileged. Key names are historical. */
export type Rank = "diamond" | "gold" | "silver" | "bronze" | "iron";

export function roleRank(roleName: string): Rank {
  const name = roleName.toLowerCase();
  if (name.includes("super")) return "diamond";
  if (name.includes("admin")) return "gold";
  if (name.includes("manager") || name.includes("lead")) return "silver";
  if (name.includes("employee") || name.includes("member")) return "bronze";
  return "iron";
}

export const ENTITY_LABELS: Record<string, string> = {
  user: "User",
  role: "Role",
  project: "Project",
  task: "Task",
  auth: "Auth",
};

export const MODULE_LABELS: Record<string, string> = {
  users: "Users",
  roles: "Roles",
  projects: "Projects",
  tasks: "Tasks",
  activity_logs: "Activity Logs",
  queues: "Queues",
};

export function humanize(value: string) {
  return value
    .replace(/[._]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** "task.created" → "Task created"; "auth.login" → "User login". */
export function actionLabel(action: string) {
  if (action === "auth.login") return "User login";
  if (action === "auth.logout") return "User logout";
  const [entity = "", verb = ""] = action.split(".");
  const noun = ENTITY_LABELS[entity] ?? humanize(entity);
  return verb ? `${noun} ${humanize(verb).toLowerCase()}` : noun;
}
