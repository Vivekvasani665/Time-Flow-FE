"use client";

import { AlertTriangle, Clock, CornerUpLeft, Inbox, Mail, MailOpen, PenSquare, RefreshCw, Send, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { Can } from "@/components/auth/can";
import { ComposeDialog, type ReplyContext } from "@/components/emails/compose-dialog";
import { TableToolbar } from "@/components/data-table/table-toolbar";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDeleteEmail, useEmail, useEmails, useMarkEmailRead, useSyncInbox } from "@/hooks/use-emails";
import { useTableParams } from "@/hooks/use-table-params";
import type { Tone } from "@/lib/labels";
import { cn, formatDateTime, fullName } from "@/lib/utils";
import { isApiError } from "@/lib/api/client";
import { toast } from "sonner";
import type { EmailDetail, EmailLog, EmailStatus, MailBox } from "@/types/api";

const FILTERS = ["box", "status", "selected"] as const;

const EMAIL_TONE: Record<EmailStatus, Tone> = { QUEUED: "amber", SENT: "lime", FAILED: "red" };

const BOXES: { value: MailBox; label: string; icon: typeof Inbox }[] = [
  { value: "inbox", label: "Inbox", icon: Inbox },
  { value: "sent", label: "Sent", icon: Send },
  { value: "all", label: "All Mail", icon: Mail },
];

export function Mailbox() {
  const { user } = useAuth();
  const [composing, setComposing] = useState(false);
  const [reply, setReply] = useState<ReplyContext | null>(null);
  const [pendingDelete, setPendingDelete] = useState<EmailDetail | null>(null);
  const { params, update } = useTableParams(FILTERS, { limit: 20 });
  const box = (BOXES.find((b) => b.value === params.filters.box)?.value ?? "inbox") as MailBox;
  const selected = params.filters.selected ?? null;

  const query = useEmails({
    page: params.page,
    limit: params.limit,
    search: params.search || undefined,
    box,
    status: params.filters.status as EmailStatus | undefined,
  });
  const detail = useEmail(selected);
  const markRead = useMarkEmailRead();
  const remove = useDeleteEmail();
  const syncInbox = useSyncInbox();

  const emails = query.data?.items ?? [];

  // Opening a message marks it read — but only the recipient has a read state,
  // so never fire this for Sent, or for someone else's mail seen via All Mail.
  const openedId = detail.data?.id;
  const openedUnread = detail.data?.readAt === null && detail.data.toUserId === user?.id;
  useEffect(() => {
    if (openedId && openedUnread) markRead.mutate({ id: openedId, read: true });
    // markRead is a stable mutation object; re-running on it would loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openedId, openedUnread]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mailbox"
        description="Everything TimeFlow sent — and the replies people sent back by email."
        actions={
          <>
            <Button
              variant="ghost"
              icon={<RefreshCw className="size-4" />}
              loading={syncInbox.isPending}
              onClick={() =>
                syncInbox.mutate(undefined, {
                  onSuccess: () => toast.success("Syncing inbox", { description: "New replies will appear in a few seconds." }),
                  onError: (e) => toast.error("Could not sync the inbox", { description: isApiError(e) ? e.message : "Try again." }),
                })
              }
            >
              Sync inbox
            </Button>
            <Can permission="emails.send">
              <Button
                icon={<PenSquare className="size-4" />}
                onClick={() => {
                  setReply(null);
                  setComposing(true);
                }}
              >
                New message
              </Button>
            </Can>
          </>
        }
      />

      <ComposeDialog
        open={composing}
        onOpenChange={(open) => {
          setComposing(open);
          if (!open) setReply(null);
        }}
        reply={reply}
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Delete this message?"
        description={
          <>
            <span className="font-semibold text-ink">{pendingDelete?.subject}</span> leaves your mailbox. The other party keeps their
            copy, and the delivery record is preserved for administrators.
          </>
        }
        confirmLabel="Delete"
        loading={remove.isPending}
        onConfirm={() => {
          const target = pendingDelete;
          if (!target) return;
          remove.mutate(target.id, {
            onSuccess: () => {
              toast.success("Message deleted");
              setPendingDelete(null);
              // The reading pane is showing what was just removed.
              update({ selected: undefined }, false);
            },
            onError: (e) => toast.error("Could not delete", { description: isApiError(e) ? e.message : "Try again." }),
          });
        }}
      />

      <div className="hud-panel clip-corner">
        <Tabs value={box} onValueChange={(v) => update({ box: v, selected: undefined })} className="px-4 pt-2 sm:px-5">
          <TabsList>
            {BOXES.map(({ value, label, icon: Icon }) => {
              const tab = (
                <TabsTrigger key={value} value={value}>
                  <Icon className="size-3.5" /> {label}
                </TabsTrigger>
              );
              return value === "all" ? (
                <Can key={value} permission="emails.view_all">
                  {tab}
                </Can>
              ) : (
                tab
              );
            })}
          </TabsList>
        </Tabs>

        <div className="border-b border-line p-4">
          <TableToolbar
            search={params.search}
            onSearch={(search) => update({ search })}
            placeholder="Search subject or recipient…"
            filters={
              <Select
                aria-label="Filter by delivery status"
                className="lg:w-40"
                value={params.filters.status}
                onValueChange={(status) => update({ status })}
                allLabel="All statuses"
                options={[
                  { value: "QUEUED", label: "Queued" },
                  { value: "SENT", label: "Sent" },
                  { value: "FAILED", label: "Failed" },
                ]}
              />
            }
          />
        </div>

        <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
          {/* Message list */}
          <div className="lg:border-r lg:border-line">
            {query.isLoading ? (
              <div className="space-y-3 p-5">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-16" />
                ))}
              </div>
            ) : query.error && emails.length === 0 ? (
              <ErrorState message={query.error.message} onRetry={() => void query.refetch()} />
            ) : emails.length === 0 ? (
              <EmptyState
                title={box === "sent" ? "Nothing sent yet" : "Mailbox empty"}
                description={
                  box === "sent"
                    ? "Mail you trigger — like creating a user — shows up here."
                    : "Messages TimeFlow sends you, and replies to mail you sent, arrive here."
                }
              />
            ) : (
              <ul className={cn("divide-y divide-line", query.isFetching && "opacity-70")}>
                {emails.map((email) => (
                  <MailRow
                    key={email.id}
                    email={email}
                    box={box}
                    active={selected === email.id}
                    onOpen={() => update({ selected: email.id }, false)}
                  />
                ))}
              </ul>
            )}

            {query.data && emails.length > 0 && (
              <div className="border-t border-line px-4 py-3">
                <Pagination
                  meta={query.data.meta}
                  onPageChange={(page) => update({ page }, false)}
                  onLimitChange={(limit) => update({ limit })}
                  pageSizes={[20, 50, 100]}
                />
              </div>
            )}
          </div>

          {/* Reading pane */}
          <div className="min-h-80 border-t border-line lg:border-t-0">
            {!selected ? (
              <EmptyState title="No message selected" description="Pick a message on the left to read it." />
            ) : detail.isLoading ? (
              <div className="space-y-3 p-5">
                <Skeleton className="h-6 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-56" />
              </div>
            ) : detail.error ? (
              <ErrorState message={detail.error.message} onRetry={() => void detail.refetch()} />
            ) : detail.data ? (
              <MailReader
                email={detail.data}
                currentUserId={user?.id}
                onClose={() => update({ selected: undefined }, false)}
                onReply={(context) => {
                  setReply(context);
                  setComposing(true);
                }}
                onDelete={() => setPendingDelete(detail.data)}
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function MailRow({ email, box, active, onOpen }: { email: EmailLog; box: MailBox; active: boolean; onOpen: () => void }) {
  // In Sent you care who received it; everywhere else, who it came from.
  const party = box === "sent" ? email.toUser : email.fromUser;
  // Mail that came in from outside names its sender; only system mail is "TimeFlow".
  const outsider = email.direction === "INBOUND" ? (email.fromName ?? email.fromAddress) : "TimeFlow";
  const partyLabel = box === "sent" ? (party ? fullName(party) : email.to) : party ? fullName(party) : outsider;
  const unread = box !== "sent" && email.readAt === null;

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        aria-current={active}
        className={cn(
          "relative flex w-full cursor-pointer items-start gap-3 px-4 py-[var(--row-py)] text-left transition-colors hover:bg-panel-2 sm:px-5",
          active && "bg-cyan/5 hover:bg-cyan/5 before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-cyan",
        )}
      >
        <span className="mt-1 flex size-2 shrink-0 items-center justify-center" aria-hidden="true">
          {unread && <span className="size-2 rounded-full bg-cyan" />}
        </span>
        <Avatar user={party} size="sm" className="shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className={cn("truncate text-sm", unread ? "font-semibold text-ink" : "text-ink-dim")}>{partyLabel}</p>
            <span className="tabular shrink-0 text-xs text-ink-mute">{formatDateTime(email.createdAt)}</span>
          </div>
          <p className={cn("truncate text-sm", unread ? "font-medium text-ink" : "text-ink-dim")}>{email.subject}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <DeliveryBadge email={email} />
            <span className="text-xs text-ink-mute">{email.template}</span>
            {email.status === "FAILED" && email.attempts > 0 && (
              <span className="text-xs text-danger">{email.attempts} attempts</span>
            )}
          </div>
        </div>
      </button>
    </li>
  );
}

/** Received mail has no delivery to track, so it says where it came from instead. */
function DeliveryBadge({ email }: { email: EmailLog }) {
  if (email.direction === "INBOUND") {
    return (
      <Badge tone="blue">RECEIVED</Badge>
    );
  }
  return (
    <Badge tone={EMAIL_TONE[email.status]}>
      {email.status}
    </Badge>
  );
}

function MailReader({
  email,
  currentUserId,
  onClose,
  onReply,
  onDelete,
}: {
  email: EmailDetail;
  currentUserId: string | undefined;
  onClose: () => void;
  onReply: (context: ReplyContext) => void;
  onDelete: () => void;
}) {
  const [showSource, setShowSource] = useState(false);

  // Reply goes to the other side of the conversation — and only exists when
  // that side is a person: system mail has no author to answer. A reply that
  // came in by email is answered by email, to the address it came from.
  const inbound = email.direction === "INBOUND";
  const member = email.toUserId === currentUserId ? email.fromUser : email.toUser;
  const counterpart: ReplyContext["to"] | null = inbound
    ? email.toUserId === currentUserId
      ? { userId: null, email: email.fromAddress, name: email.fromName ?? email.fromAddress }
      : null
    : member
      ? { userId: member.id, email: member.email, name: fullName(member) }
      : null;
  // `emails.view_all` lets an admin read someone else's mail but not delete it.
  const mine = email.toUserId === currentUserId || email.fromUserId === currentUserId;

  return (
    <article className="animate-fade-up">
      <header className="space-y-3 border-b border-line p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight text-ink">{email.subject}</h2>
          <div className="flex shrink-0 items-center gap-1">
            {counterpart && (
              <Can permission="emails.send">
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<CornerUpLeft className="size-4" />}
                  onClick={() => onReply({ id: email.id, subject: email.subject, to: counterpart, quote: email.bodyText })}
                >
                  Reply
                </Button>
              </Can>
            )}
            {mine && (
              <Button
                variant="ghost"
                size="sm"
                icon={<Trash2 className="size-4" />}
                onClick={onDelete}
                aria-label="Delete message"
              />
            )}
            <Button variant="ghost" size="sm" icon={<X className="size-4" />} onClick={onClose} aria-label="Close message" />
          </div>
        </div>
        {email.replyTo && (
          <p className="text-xs text-ink-mute">
            In reply to <span className="text-ink-dim">{email.replyTo.subject}</span> · {formatDateTime(email.replyTo.createdAt)}
          </p>
        )}
        <dl className="grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[auto_1fr]">
          <dt className="text-ink-mute">From</dt>
          <dd className="text-ink-dim">
            {email.fromUser ? `${fullName(email.fromUser)} · ` : email.fromName ? `${email.fromName} · ` : ""}
            <span className="font-mono">{email.fromAddress}</span>
          </dd>
          <dt className="text-ink-mute">To</dt>
          <dd className="text-ink-dim">
            {email.toUser ? `${fullName(email.toUser)} · ` : ""}
            <span className="font-mono">{email.to}</span>
          </dd>
          <dt className="text-ink-mute">Date</dt>
          <dd className="tabular text-ink-dim">{formatDateTime(email.sentAt ?? email.createdAt)}</dd>
        </dl>
        <div className="flex flex-wrap items-center gap-2">
          <DeliveryBadge email={email} />
          <span className="text-xs text-ink-mute">{email.template}</span>
          {email.readAt ? (
            <span className="inline-flex items-center gap-1 text-xs text-ink-mute">
              <MailOpen className="size-3" /> Read {formatDateTime(email.readAt)}
            </span>
          ) : null}
          {email.status === "QUEUED" && (
            <span className="inline-flex items-center gap-1 text-xs text-amber">
              <Clock className="size-3" /> Awaiting delivery
            </span>
          )}
        </div>
        {email.lastError && (
          <p className="flex items-start gap-2 rounded-lg border border-danger/25 bg-danger/5 p-3 text-sm text-danger">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            {email.lastError}
          </p>
        )}
      </header>

      <div className="p-5">
        {showSource || !email.bodyHtml ? (
          <pre className="overflow-x-auto rounded-lg border border-line bg-panel-2 p-4 font-sans text-sm leading-relaxed whitespace-pre-wrap text-ink">
            {email.bodyText ?? email.bodyHtml ?? "This message was recorded before bodies were stored, so there is nothing to show."}
          </pre>
        ) : (
          // Sandboxed: the mail's own HTML must not inherit app styles or run scripts.
          <iframe
            title={`Message: ${email.subject}`}
            sandbox=""
            srcDoc={email.bodyHtml}
            className="h-96 w-full rounded-lg border border-line bg-white"
          />
        )}
        {email.bodyHtml && email.bodyText && (
          <Button variant="ghost" size="sm" className="mt-3" onClick={() => setShowSource((v) => !v)}>
            {showSource ? "Show rendered" : "Show plain text"}
          </Button>
        )}
      </div>
    </article>
  );
}
