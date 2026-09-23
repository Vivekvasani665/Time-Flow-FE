"use client";

import { ChevronDown, Download, FilterX } from "lucide-react";
import { Fragment, useState } from "react";
import { Can } from "@/components/auth/can";
import { TableToolbar } from "@/components/data-table/table-toolbar";
import { UserSelect } from "@/components/forms/user-select";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { useActivityLogs } from "@/hooks/use-activity";
import { useTableParams } from "@/hooks/use-table-params";
import { ENTITY_LABELS } from "@/lib/labels";
import { cn, formatDateTime, fullName } from "@/lib/utils";
import { activityService } from "@/services/activity.service";
import type { ActivityListParams } from "@/types/api";
import { ActivityChart } from "./activity-chart";
import { EntityIcon } from "./activity-feed";

const FILTERS = ["entity", "action", "userId", "from", "to"] as const;

const ACTIONS = [
  "auth.login",
  "auth.logout",
  "auth.login_failed",
  "auth.refresh_token_reused",
  "user.created",
  "user.updated",
  "user.status_changed",
  "user.role_changed",
  "user.deleted",
  "user.password_reset_requested",
  "user.password_reset_completed",
  "user.password_reset_expired",
  "role.created",
  "role.updated",
  "role.permissions_changed",
  "role.deleted",
  "project.created",
  "project.updated",
  "project.status_changed",
  "project.deleted",
  "task.created",
  "task.updated",
  "task.status_changed",
  "task.assigned",
  "task.deleted",
  "activity_logs.exported",
  "queue.job_retried",
];

export function ActivityList() {
  const { params, apiParams, update } = useTableParams(FILTERS, { limit: 20 });
  const query = useActivityLogs(apiParams as ActivityListParams);
  const [expanded, setExpanded] = useState<string | null>(null);
  const logs = query.data?.items ?? [];
  const hasFilters = Boolean(params.search || Object.keys(params.filters).length);

  const clear = () => update({ search: undefined, entity: undefined, action: undefined, userId: undefined, from: undefined, to: undefined });

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Audit trail"
        title="Activity Logs"
        description="A record of every significant action in your workspace."
        actions={
          <Can permission="activity_logs.export">
            <a
              href={activityService.exportUrl(apiParams as ActivityListParams)}
              className={buttonClasses("secondary")}
            >
              <Download className="size-4" /> Export CSV
            </a>
          </Can>
        }
      />

      <div className="hud-panel clip-corner">
        <ActivityChart params={apiParams as ActivityListParams} onSelectDay={(date) => update({ from: date, to: date })} />

        <div className="space-y-3 border-b border-line p-4">
          <TableToolbar
            search={params.search}
            onSearch={(search) => update({ search })}
            placeholder="Search descriptions…"
            filters={
              <>
                <Select
                  aria-label="Filter by entity"
                  className="lg:w-36"
                  value={params.filters.entity}
                  onValueChange={(entity) => update({ entity })}
                  allLabel="All entities"
                  options={Object.entries(ENTITY_LABELS).map(([value, label]) => ({ value, label }))}
                />
                <Select
                  aria-label="Filter by action"
                  className="lg:w-52"
                  value={params.filters.action}
                  onValueChange={(action) => update({ action })}
                  allLabel="All actions"
                  options={ACTIONS.map((a) => ({ value: a, label: a }))}
                />
                <UserSelect id="filter-user" className="lg:w-48" value={params.filters.userId} onChange={(userId) => update({ userId })} allLabel="All users" placeholder="All users" />
              </>
            }
          />
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-ink-mute">From</span>
              <Input type="date" className="h-9 w-40 text-sm" value={params.filters.from ?? ""} max={params.filters.to} onChange={(e) => update({ from: e.target.value })} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-ink-mute">To</span>
              <Input type="date" className="h-9 w-40 text-sm" value={params.filters.to ?? ""} min={params.filters.from} onChange={(e) => update({ to: e.target.value })} />
            </label>
            {hasFilters && (
              <Button variant="ghost" size="sm" icon={<FilterX className="size-3.5" />} onClick={clear}>
                Clear filters
              </Button>
            )}
          </div>
        </div>

        {query.isLoading ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : query.error && logs.length === 0 ? (
          <ErrorState message={query.error.message} onRetry={() => void query.refetch()} />
        ) : logs.length === 0 ? (
          <EmptyState
            title={hasFilters ? "No activity matches" : "No activity yet"}
            description={hasFilters ? "Try widening the date range or clearing filters." : "Actions will appear here as your team works."}
          />
        ) : (
          <ul className={cn("divide-y divide-line/60", query.isFetching && "opacity-70")}>
            {logs.map((log) => {
              const open = expanded === log.id;
              const hasMeta = Object.keys(log.metadata ?? {}).length > 0;
              return (
                <Fragment key={log.id}>
                  <li>
                    <button
                      type="button"
                      onClick={() => setExpanded(open ? null : log.id)}
                      aria-expanded={open}
                      className="flex w-full items-start gap-3 px-4 py-[var(--row-py)] text-left transition-colors hover:bg-panel-2 sm:items-center sm:px-5"
                    >
                      <EntityIcon entity={log.entity} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-ink">{log.description}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-mute">
                          <span className="inline-flex items-center gap-1.5">
                            <Avatar user={log.user} size="xs" className="size-4 text-[0.45rem]" />
                            {log.user ? fullName(log.user) : "System"}
                          </span>
                          <Badge tone="gray" className="font-mono">{log.action}</Badge>
                          {log.ipAddress && <span className="tabular">{log.ipAddress}</span>}
                        </div>
                      </div>
                      <span className="tabular hidden text-xs whitespace-nowrap text-ink-dim sm:block">{formatDateTime(log.createdAt)}</span>
                      <ChevronDown className={cn("mt-1 size-4 shrink-0 text-ink-mute transition-transform sm:mt-0", open && "rotate-180 text-ink")} />
                    </button>
                    {open && (
                      <div className="border-t border-line/60 bg-panel-2 px-5 py-4 animate-fade-up">
                        <dl className="grid gap-3 text-sm sm:grid-cols-3">
                          <div>
                            <dt className="text-xs text-ink-mute">Entity</dt>
                            <dd className="mt-0.5 font-mono text-xs text-ink">
                              {log.entity}
                              {log.entityId ? ` · ${log.entityId}` : ""}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-xs text-ink-mute">Timestamp</dt>
                            <dd className="tabular mt-0.5 font-mono text-xs text-ink">{new Date(log.createdAt).toISOString()}</dd>
                          </div>
                          <div>
                            <dt className="text-xs text-ink-mute">IP address</dt>
                            <dd className="tabular mt-0.5 font-mono text-xs text-ink">{log.ipAddress ?? "—"}</dd>
                          </div>
                        </dl>
                        {hasMeta && (
                          <pre className="mt-3 overflow-x-auto rounded-lg border border-line bg-panel p-3 font-mono text-xs text-ink-dim">
                            {JSON.stringify(log.metadata, null, 2)}
                          </pre>
                        )}
                      </div>
                    )}
                  </li>
                </Fragment>
              );
            })}
          </ul>
        )}

        {query.data && logs.length > 0 && (
          <div className="border-t border-line px-4 py-3">
            <Pagination meta={query.data.meta} onPageChange={(page) => update({ page }, false)} onLimitChange={(limit) => update({ limit })} pageSizes={[20, 50, 100]} />
          </div>
        )}
      </div>
    </div>
  );
}
