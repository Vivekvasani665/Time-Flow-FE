import { api, toQuery } from "@/lib/api/client";
import type { EmailDetail, EmailLog, EmailStats, EmailStatus, ListParams, MailBox } from "@/types/api";

export type EmailListParams = ListParams & {
  box?: MailBox;
  status?: EmailStatus;
  unreadOnly?: boolean;
};

/** Exactly one of `toUserId` (a team member) or `toEmail` (any address). */
export type ComposeInput = {
  toUserId?: string;
  toEmail?: string;
  subject: string;
  body: string;
  /** Threads this under a message you are a party to. */
  replyToId?: string;
};

export const emailService = {
  list: (params: EmailListParams) => api.list<EmailLog>("/emails", toQuery(params)),
  send: (input: ComposeInput) => api.post<{ id: string }>("/emails", input),
  get: (id: string) => api.get<EmailDetail>(`/emails/${id}`),
  stats: () => api.get<EmailStats>("/emails/stats"),
  markRead: (id: string, read: boolean) => api.patch<{ id: string; readAt: string | null }>(`/emails/${id}/read`, { read }),
  /** Brings the next inbox poll forward; replies appear in the list once it has run. */
  syncInbox: () => api.post<{ queued: boolean }>("/emails/sync"),
  /** Per-side soft delete: it leaves your folder, the other party keeps theirs. */
  remove: (id: string) => api.delete<null>(`/emails/${id}`),
};
