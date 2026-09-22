// Mirrors docs/api-contract.md. Keep in sync with the backend.

export type UserStatus = "ACTIVE" | "INACTIVE";
export type ProjectStatus = "PLANNING" | "ACTIVE" | "ON_HOLD" | "COMPLETED" | "ARCHIVED";
export type TaskStatus = "TODO" | "IN_PROGRESS" | "REVIEW" | "COMPLETED";
export type Priority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type EmailStatus = "QUEUED" | "SENT" | "FAILED";
export type SortOrder = "asc" | "desc";

export type ApiSuccess<T> = {
  success: true;
  data: T;
  message?: string;
  meta?: PaginationMeta;
};

export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  unread?: number;
};

export type ValidationDetail = { path: string; message: string };

export type ApiFailure = {
  success: false;
  message: string;
  code: string;
  details?: ValidationDetail[];
  requestId?: string;
};

export type Paginated<T> = { items: T[]; meta: PaginationMeta };

export type ListParams = {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: SortOrder;
};

export type RoleRef = { id: string; name: string };

import type { Preferences } from "@/lib/preferences";

export type { Preferences };

export type AuthUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  status: UserStatus;
  role: RoleRef;
  permissions: string[];
  preferences: Preferences;
  twoFactorEnabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
};

export type UserRef = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl: string | null;
};

export type User = UserRef & {
  phone: string | null;
  status: UserStatus;
  role: RoleRef;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  stats?: { assignedTasks: number; completedTasks: number; projects: number };
};

export type Permission = {
  id: string;
  key: string;
  module: string;
  action: string;
  description: string | null;
};

export type Role = {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: string[];
  userCount: number;
  createdAt: string;
  updatedAt: string;
};

export type Project = {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  priority: Priority;
  startDate: string;
  endDate: string | null;
  manager: UserRef;
  members: UserRef[];
  taskStats: { total: number; completed: number };
  createdAt: string;
  updatedAt: string;
};

export type Task = {
  id: string;
  title: string;
  description: string | null;
  project: { id: string; name: string };
  assignee: UserRef | null;
  createdBy: UserRef | null;
  status: TaskStatus;
  priority: Priority;
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ActivityLog = {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  description: string;
  metadata: Record<string, unknown>;
  ipAddress: string | null;
  user: UserRef | null;
  createdAt: string;
};

export type ActivityStats = {
  /** Inclusive UTC day range the counts cover (YYYY-MM-DD). */
  from: string;
  to: string;
  total: number;
  days: { date: string; count: number }[];
  byEntity: { entity: string; count: number }[];
  byAction: { action: string; count: number }[];
};

export type Notification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

export type DashboardData = {
  stats: {
    totalUsers: number | null;
    activeUsers: number | null;
    totalProjects: number;
    activeProjects: number;
    totalTasks: number;
    completedTasks: number;
  };
  tasksByStatus: { status: TaskStatus; count: number }[];
  projectsByStatus: { status: ProjectStatus; count: number }[];
  recentProjects: Project[];
  recentActivity: ActivityLog[];
  myTasks: Task[];
};

export type QueueName = "email" | "activity" | "email-dead-letter";
export type JobState = "waiting" | "active" | "completed" | "failed" | "delayed";

export type QueueSummary = {
  name: string;
  counts: Record<JobState, number>;
};

export type QueueJob = {
  id: string;
  name: string;
  data: Record<string, unknown>;
  attemptsMade: number;
  failedReason: string | null;
  timestamp: number;
  finishedOn: number | null;
};

/** Which mailbox folder a listing is scoped to. */
export type MailBox = "inbox" | "sent" | "all";

/** Recipient / sender identity shown in a mail header. */
export type EmailParty = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl: string | null;
};

/** OUTBOUND: TimeFlow sent it. INBOUND: a reply to TimeFlow mail, pulled from the sending inbox. */
export type EmailDirection = "OUTBOUND" | "INBOUND";

export type EmailLog = {
  id: string;
  to: string;
  fromAddress: string;
  /** Display name of an outside sender; only set on INBOUND mail. */
  fromName: string | null;
  direction: EmailDirection;
  subject: string;
  template: string;
  status: EmailStatus;
  attempts: number;
  lastError: string | null;
  readAt: string | null;
  sentAt: string | null;
  createdAt: string;
  toUser: EmailParty | null;
  fromUser: EmailParty | null;
};

/** `GET /emails/:id` — adds the rendered body, omitted from list rows. */
export type EmailDetail = EmailLog & {
  bodyHtml: string | null;
  bodyText: string | null;
  jobId: string | null;
  toUserId: string | null;
  fromUserId: string | null;
  /** Set when this message was composed as a reply to another. */
  replyToId: string | null;
  replyTo: { id: string; subject: string; createdAt: string } | null;
};

export type EmailStats = {
  total: number;
  queued: number;
  sent: number;
  failed: number;
  unread: number;
  last24h: number;
  /** "all" for admins, "own" for everyone else. */
  scope: "all" | "own";
};

// ── Payloads ────────────────────────────────────────────────

export type CreateUserInput = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  password: string;
  roleId: string;
  status?: UserStatus;
  avatarUrl?: string | null;
};
export type UpdateUserInput = Partial<CreateUserInput>;

export type UserListParams = ListParams & { status?: UserStatus; roleId?: string };

export type RoleInput = { name: string; description?: string | null; permissions: string[] };

export type ProjectInput = {
  name: string;
  description?: string | null;
  status?: ProjectStatus;
  priority?: Priority;
  startDate: string;
  endDate?: string | null;
  managerId: string;
  memberIds?: string[];
};
export type ProjectStats = {
  total: number;
  byStatus: { status: ProjectStatus; count: number }[];
  newThisWeek: number;
  /** Distinct people (managers and members) across the visible projects. */
  members: number;
  membersAddedThisWeek: number;
};

export type ProjectListParams = ListParams & {
  status?: ProjectStatus;
  priority?: Priority;
  managerId?: string;
};

export type TaskInput = {
  title: string;
  description?: string | null;
  projectId: string;
  assigneeId?: string | null;
  status?: TaskStatus;
  priority?: Priority;
  dueDate?: string | null;
};
export type TaskListParams = ListParams & {
  status?: TaskStatus;
  priority?: Priority;
  projectId?: string;
  assigneeId?: string;
};

export type ActivityListParams = ListParams & {
  entity?: string;
  action?: string;
  userId?: string;
  from?: string;
  to?: string;
};

/** One signed-in device — a refresh-token family. */
export type Session = {
  familyId: string;
  ipAddress: string | null;
  userAgent: string | null;
  lastSeenAt: string;
  expiresAt: string;
  /** The device making this request. */
  current: boolean;
};

/** Organisation mail account, as returned by the API — never includes the password. */
export type MailSettings = {
  configured: boolean;
  enabled: boolean;
  provider: "gmail" | "custom";
  host: string | null;
  port: number | null;
  username: string | null;
  fromAddress: string | null;
  fromName: string | null;
  passwordSet: boolean;
  lastVerifiedAt: string | null;
  updatedAt: string | null;
};

export type MailSettingsInput = { username: string; password?: string; fromName: string; enabled?: boolean };
export type MailTestResult = { ok: boolean; code?: string; message?: string };
