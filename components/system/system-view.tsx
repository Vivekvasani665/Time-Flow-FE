"use client";

import { ArrowRight, ExternalLink, Inbox, Mail, RotateCcw, Server } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Can } from "@/components/auth/can";
import { MailAccountPanel } from "@/components/system/mail-account-panel";
import { usePermissions } from "@/components/auth/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { Panel } from "@/components/ui/panel";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEmails, useEmailStats } from "@/hooks/use-emails";
import { useQueueJobs, useQueues, useRetryJob } from "@/hooks/use-system";
import type { Tone } from "@/lib/labels";
import { TONE } from "@/components/ui/tone";
import { cn, formatDateTime } from "@/lib/utils";
import type { EmailStats, EmailStatus, JobState } from "@/types/api";
import { notifyError } from "@/lib/notify";

const STATES: { state: JobState; label: string; short: string; tone: Tone }[] = [
  { state: "waiting", label: "Waiting", short: "Wait", tone: "blue" },
  { state: "active", label: "Active", short: "Active", tone: "cyan" },
  { state: "delayed", label: "Delayed", short: "Delay", tone: "amber" },
  { state: "completed", label: "Completed", short: "Done", tone: "lime" },
  { state: "failed", label: "Failed", short: "Failed", tone: "red" },
];

const EMAIL_TONE: Record<EmailStatus, Tone> = { QUEUED: "amber", SENT: "lime", FAILED: "red" };
const EMAIL_LABEL: Record<EmailStatus, string> = { QUEUED: "Queued", SENT: "Sent", FAILED: "Failed" };

const EMAIL_STATS: { key: keyof Pick<EmailStats, "total" | "sent" | "queued" | "failed" | "last24h">; label: string; tone: Tone }[] = [
  { key: "total", label: "Total", tone: "gray" },
  { key: "sent", label: "Delivered", tone: "lime" },
  { key: "queued", label: "Queued", tone: "amber" },
  { key: "failed", label: "Failed", tone: "red" },
  { key: "last24h", label: "Last 24h", tone: "cyan" },
];

/** Email counters, refreshed on the page's 5s cadence. */
function EmailStatsStrip({ stats, loading }: { stats: EmailStats | undefined; loading: boolean }) {
  if (loading && !stats) return <Skeleton className="h-24" />;
  if (!stats) return null;

  return (
    <div className={cn("hud-panel clip-corner p-5", stats.failed > 0 && "border-danger/40")}>
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Mail className="size-4 text-ink-mute" /> Email volume
        </span>
        <span className="text-xs text-ink-mute">
          {stats.scope === "all" ? "All mail" : "Your mail"}
          {stats.unread > 0 && <span className="ml-2 font-medium text-cyan">{stats.unread} unread</span>}
        </span>
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-5">
        {EMAIL_STATS.map((s) => (
          <div key={s.key} className="min-w-0">
            <dd className="tabular text-2xl font-semibold tracking-tight text-ink">{stats[s.key]}</dd>
            <dt className="flex items-center gap-1.5 truncate text-xs text-ink-mute">
              <span className={cn("size-1.5 shrink-0 rounded-full", TONE[s.tone].dot)} aria-hidden="true" />
              {s.label}
            </dt>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function SystemView() {
  const queues = useQueues();
  const [selected, setSelected] = useState<string>("email");
  const [state, setState] = useState<JobState>("failed");
  const jobs = useQueueJobs(selected, state);
  const retry = useRetryJob();
  const [emailPage, setEmailPage] = useState(1);
  const [emailStatus, setEmailStatus] = useState<EmailStatus | undefined>();
  // This page is gated on queues.view, but the email endpoints want emails.*.
  // Without these guards a queues-only role would poll two 403s every 5s.
  const { can } = usePermissions();
  const canSeeAllMail = can("emails.view_all");
  const canSeeMail = can("emails.view");
  const emails = useEmails({ page: emailPage, limit: 10, status: emailStatus, box: "all" }, canSeeAllMail);
  const emailStats = useEmailStats(canSeeMail);

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Diagnostics"
        title="System Monitor"
        description="Background job queues and the transactional email outbox. Refreshes every 5 seconds."
        actions={
          <a
            href="/admin/queues"
            target="_blank"
            rel="noreferrer"
            className={buttonClasses("secondary")}
          >
            Bull Board <ExternalLink className="size-3.5" />
          </a>
        }
      />

      {queues.error && !queues.data ? (
        <div className="hud-panel clip-corner">
          <ErrorState error={queues.error} onRetry={() => queues.refetch()} />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {queues.isLoading || !queues.data
            ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40" />)
            : queues.data.map((q) => {
                const active = q.name === selected;
                return (
                  <button
                    key={q.name}
                    type="button"
                    onClick={() => setSelected(q.name)}
                    aria-pressed={active}
                    className={cn(
                      "hud-panel clip-corner p-5 text-left transition-colors",
                      active ? "border-cyan ring-1 ring-cyan" : "hover:border-line-bright",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-sm font-semibold text-ink">
                        <Server className={cn("size-4", active ? "text-cyan" : "text-ink-mute")} /> {q.name}
                      </span>
                      <span className={cn("size-2 rounded-full", q.counts.failed > 0 ? "bg-danger" : "bg-lime")} aria-hidden="true" />
                    </div>
                    <dl className="mt-4 grid grid-cols-5 gap-2">
                      {STATES.map((s) => (
                        <div key={s.state} className="min-w-0" title={s.label}>
                          <dd className="tabular text-xl font-semibold tracking-tight text-ink">{q.counts[s.state] ?? 0}</dd>
                          <dt className="flex items-center gap-1 truncate text-xs text-ink-mute">
                            <span className={cn("size-1.5 shrink-0 rounded-full", TONE[s.tone].dot)} aria-hidden="true" />
                            <span aria-hidden="true">{s.short}</span>
                            <span className="sr-only">{s.label}</span>
                          </dt>
                        </div>
                      ))}
                    </dl>
                  </button>
                );
              })}
        </div>
      )}

      <Panel title={`Jobs · ${selected}`} icon={<Inbox />} bodyClassName="p-0">
        <Tabs value={state} onValueChange={(v) => setState(v as JobState)} className="px-5 pt-2">
          <TabsList>
            {STATES.map((s) => (
              <TabsTrigger key={s.state} value={s.state}>
                {s.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        {jobs.isLoading ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        ) : jobs.error ? (
          <ErrorState error={jobs.error} onRetry={() => jobs.refetch()} />
        ) : !jobs.data || jobs.data.length === 0 ? (
          <EmptyState title={`No ${state} jobs`} description="There are no jobs in this state." />
        ) : (
          <ul className="divide-y divide-line/60">
            {jobs.data.map((job) => (
              <li key={job.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-ink">{job.name}</span>
                    <span className="tabular font-mono text-xs text-ink-mute">#{job.id}</span>
                    <Badge tone={job.attemptsMade > 1 ? "amber" : "gray"}>Attempts: {job.attemptsMade}</Badge>
                  </div>
                  {job.failedReason && <p className="font-mono text-xs break-words text-danger">{job.failedReason}</p>}
                  <pre className="max-h-24 overflow-auto font-mono text-[0.7rem] text-ink-mute">{JSON.stringify(job.data)}</pre>
                </div>
                <div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-end">
                  <span className="tabular text-xs text-ink-dim">{formatDateTime(job.finishedOn ?? job.timestamp)}</span>
                  {state === "failed" && (
                    <Can permission="queues.manage">
                      <Button
                        size="sm"
                        variant="secondary"
                        icon={<RotateCcw className="size-3.5" />}
                        loading={retry.isPending && retry.variables?.id === job.id}
                        onClick={() =>
                          retry.mutate(
                            { name: selected, id: job.id },
                            {
                              onSuccess: () => toast.success("Job re-queued", { description: `${job.name} #${job.id}` }),
                              onError: (e) => notifyError(e, { title: "Retry failed" }),
                            },
                          )
                        }
                      >
                        Retry
                      </Button>
                    </Can>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Can permission="emails.configure">
        <MailAccountPanel />
      </Can>

      <EmailStatsStrip stats={emailStats.data} loading={emailStats.isLoading} />

      <Panel
        title="Email outbox"
        icon={<Mail />}
        bodyClassName="p-0"
        actions={
          <div className="flex items-center gap-2">
            <Select
              aria-label="Filter emails by status"
              className="h-8 w-36 text-xs"
              value={emailStatus}
              onValueChange={(v) => {
                setEmailStatus(v as EmailStatus | undefined);
                setEmailPage(1);
              }}
              allLabel="All statuses"
              options={[
                { value: "QUEUED", label: "Queued" },
                { value: "SENT", label: "Sent" },
                { value: "FAILED", label: "Failed" },
              ]}
            />
            <Link
              href="/emails"
              className={buttonClasses("secondary", "sm")}
            >
              Mailbox <ArrowRight className="size-3" />
            </Link>
          </div>
        }
      >
        {emails.isLoading ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : emails.error ? (
          <ErrorState error={emails.error} onRetry={() => emails.refetch()} />
        ) : !emails.data || emails.data.items.length === 0 ? (
          <EmptyState title="No emails yet" description="Emails appear here once the app sends one, such as a welcome email for a new user." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left">
                <caption className="sr-only">Email log</caption>
                <thead>
                  <tr className="border-b border-line bg-panel-2 text-xs font-medium text-ink-mute">
                    <th className="px-5 py-3">Recipient</th>
                    <th className="px-5 py-3">Template</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Attempts</th>
                    <th className="px-5 py-3">Last error</th>
                    <th className="px-5 py-3">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {emails.data.items.map((e) => (
                    <tr key={e.id} className="border-b border-line/60">
                      <td className="px-5 py-3">
                        <Link href={`/emails?box=all&selected=${e.id}`} className="block hover:text-cyan">
                          <p className="text-sm font-medium">{e.to}</p>
                          <p className="text-xs text-ink-mute">{e.subject}</p>
                        </Link>
                      </td>
                      <td className="px-5 py-3 font-mono text-xs text-ink-dim">{e.template}</td>
                      <td className="px-5 py-3">
                        <Badge tone={EMAIL_TONE[e.status]}>
                          <span className={cn("size-1.5 rounded-full", TONE[EMAIL_TONE[e.status]].dot)} aria-hidden="true" />
                          {EMAIL_LABEL[e.status]}
                        </Badge>
                      </td>
                      <td className="tabular px-5 py-3 text-sm">{e.attempts}</td>
                      <td className="max-w-64 truncate px-5 py-3 font-mono text-xs text-danger" title={e.lastError ?? undefined}>
                        {e.lastError ?? "—"}
                      </td>
                      <td className="tabular px-5 py-3 text-xs text-ink-dim">{formatDateTime(e.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-line px-5 py-3">
              <Pagination meta={emails.data.meta} onPageChange={setEmailPage} />
            </div>
          </>
        )}
      </Panel>
    </div>
  );
}
