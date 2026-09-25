"use client";

import { ArrowRight, CircleCheckBig, CirclePause, Eye, FolderKanban, FolderOpen, Pencil, Plus, Rocket, Target, Trash2, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { ActivityFeed } from "@/components/activity/activity-feed";
import { useAuth, usePermissions } from "@/components/auth/auth-provider";
import { Can } from "@/components/auth/can";
import { StatTile } from "@/components/dashboard/stat-tile";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { RowActions } from "@/components/data-table/row-actions";
import { TableToolbar } from "@/components/data-table/table-toolbar";
import { UserSelect } from "@/components/forms/user-select";
import { Avatar, AvatarStack } from "@/components/ui/avatar";
import { PriorityIndicator, ProjectStatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/states";
import { TONE } from "@/components/ui/tone";
import { useActivityLogs } from "@/hooks/use-activity";
import { useDeleteProject, useProjectStats, useProjects } from "@/hooks/use-projects";
import { useTableParams } from "@/hooks/use-table-params";
import { actionLabel, PRIORITIES, PRIORITY, PROJECT_STATUS, PROJECT_STATUSES, type Tone } from "@/lib/labels";
import { cn, formatDate, fullName, percent } from "@/lib/utils";
import type { Project, ProjectListParams, ProjectStats, ProjectStatus } from "@/types/api";
import { notifyError } from "@/lib/notify";

const FILTERS = ["status", "priority", "managerId"] as const;

/** SVG strokes can't take Tailwind classes, so the donut reads the same tokens directly. */
const TONE_VAR: Record<Tone, string> = {
  cyan: "var(--color-cyan)",
  violet: "var(--color-violet)",
  magenta: "var(--color-magenta)",
  lime: "var(--color-lime)",
  amber: "var(--color-amber)",
  red: "var(--color-danger)",
  blue: "var(--color-blue)",
  gray: "var(--color-ink-mute)",
};

/** Statuses shown in the donut legend, in lifecycle order; archived only appears when it has projects. */
const DONUT_ORDER: ProjectStatus[] = ["ACTIVE", "PLANNING", "ON_HOLD", "COMPLETED", "ARCHIVED"];

function ProjectStatusDonut({ stats }: { stats: ProjectStats }) {
  const counts = new Map(stats.byStatus.map((g) => [g.status, g.count]));
  const rows = DONUT_ORDER.filter((s) => s !== "ARCHIVED" || (counts.get(s) ?? 0) > 0).map((status) => ({ status, count: counts.get(status) ?? 0 }));
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const gap = rows.filter((r) => r.count > 0).length > 1 ? 2 : 0;
  let offset = 0;

  return (
    <section className="hud-panel rounded-2xl p-5">
      <h2 className="font-semibold text-ink">Project Status</h2>
      <div className="mt-3 flex items-center gap-5">
        <div className="relative size-22 shrink-0">
          <svg viewBox="0 0 88 88" className="size-full -rotate-90" role="img" aria-label={`Projects by status: ${rows.map((r) => `${PROJECT_STATUS[r.status].label} ${r.count}`).join(", ")}`}>
            <circle cx="44" cy="44" r={radius} fill="none" stroke="var(--color-panel-3)" strokeWidth="9" />
            {stats.total > 0 &&
              rows.map((r) => {
                if (r.count === 0) return null;
                const length = (r.count / stats.total) * circumference;
                const arc = (
                  <circle
                    key={r.status}
                    cx="44"
                    cy="44"
                    r={radius}
                    fill="none"
                    stroke={TONE_VAR[PROJECT_STATUS[r.status].tone]}
                    strokeWidth="9"
                    strokeDasharray={`${Math.max(0, length - gap)} ${circumference}`}
                    strokeDashoffset={-offset}
                  />
                );
                offset += length;
                return arc;
              })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="tabular text-xl font-bold text-ink">{stats.total}</span>
            <span className="text-[0.65rem] text-ink-mute">Total</span>
          </div>
        </div>
        <ul className="min-w-0 flex-1 space-y-2">
          {rows.map((r) => (
            <li key={r.status} className="flex items-center gap-2 text-xs">
              <span className={cn("size-2 shrink-0 rounded-full", TONE[PROJECT_STATUS[r.status].tone].dot)} aria-hidden="true" />
              <span className="flex-1 truncate text-ink-dim">{PROJECT_STATUS[r.status].label}</span>
              <span className="tabular whitespace-nowrap text-ink">
                {r.count} <span className="text-ink-mute">({percent(r.count, stats.total)}%)</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function StatsRow() {
  const { data: stats, isLoading } = useProjectStats();
  if (isLoading || !stats) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-[repeat(5,minmax(0,1fr))_minmax(0,1.35fr)]">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-2xl" />
        ))}
      </div>
    );
  }
  const count = (s: ProjectStatus) => stats.byStatus.find((g) => g.status === s)?.count ?? 0;
  const share = (s: ProjectStatus) => `${percent(count(s), stats.total)}% of projects`;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-[repeat(5,minmax(0,1fr))_minmax(0,1.35fr)]">
      <StatTile label="Total Projects" value={stats.total} icon={FolderKanban} tone="blue" caption={stats.newThisWeek > 0 ? `+${stats.newThisWeek} new this week` : "No new this week"} />
      <StatTile label="Active Projects" value={count("ACTIVE")} icon={Rocket} tone="cyan" caption={share("ACTIVE")} />
      <StatTile label="On Hold" value={count("ON_HOLD")} icon={CirclePause} tone="amber" caption={share("ON_HOLD")} />
      <StatTile label="Completed" value={count("COMPLETED")} icon={CircleCheckBig} tone="lime" caption={share("COMPLETED")} />
      <StatTile
        label="Total Members"
        value={stats.members}
        icon={Users}
        tone="violet"
        caption={stats.membersAddedThisWeek > 0 ? `+${stats.membersAddedThisWeek} added this week` : "No one added this week"}
      />
      <ProjectStatusDonut stats={stats} />
    </div>
  );
}

function RecentProjectActivity() {
  const query = useActivityLogs({ entity: "project", limit: 5 });
  const items = query.data?.items ?? [];
  return (
    <section className="hud-panel rounded-2xl p-5">
      <header className="mb-5 flex items-center justify-between gap-3">
        <h2 className="font-semibold text-ink">Recent Activity</h2>
        <Link href="/activity?entity=project" className="flex items-center gap-1 text-xs font-medium text-cyan hover:underline">
          View all <ArrowRight className="size-3" aria-hidden="true" />
        </Link>
      </header>
      {query.isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState title="No project activity yet" description="Changes to projects will appear here." className="py-6" />
      ) : (
        <ActivityFeed items={items} describeAction={actionLabel} />
      )}
    </section>
  );
}

function TeamsCard() {
  return (
    <section className="hud-panel rounded-2xl p-3">
      <div className="flex items-center gap-4 rounded-xl bg-cyan/[0.06] px-5 py-6">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-cyan/10 text-cyan" aria-hidden="true">
          <Target className="size-8" strokeWidth={1.75} />
        </span>
        <div>
          <p className="font-semibold text-ink">Great things happen with great teams.</p>
          <p className="mt-1 text-xs text-ink-mute">Keep pushing, you&apos;re doing amazing!</p>
        </div>
      </div>
    </section>
  );
}

export function ProjectsList() {
  const { user: me } = useAuth();
  const { can } = usePermissions();
  const { params, apiParams, update, toggleSort } = useTableParams(FILTERS);
  const query = useProjects(apiParams as ProjectListParams);
  const remove = useDeleteProject();
  const [pending, setPending] = useState<Project | null>(null);
  const canViewActivity = can("activity_logs.view");

  const canManage = (p: Project) => can("projects.view_all") || p.manager.id === me?.id;

  const columns: Column<Project>[] = [
    {
      key: "name",
      header: "Project",
      sortKey: "name",
      primary: true,
      className: "min-w-60",
      cell: (p) => {
        const tone = TONE[PROJECT_STATUS[p.status].tone];
        return (
          <div className="flex min-w-0 items-center gap-3">
            <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", tone.bg, tone.text)} aria-hidden="true">
              <FolderKanban className="size-5" />
            </span>
            <div className="min-w-0">
              <Link href={`/projects/${p.id}`} onClick={(e) => e.stopPropagation()} className="block truncate font-medium text-ink hover:text-cyan">
                {p.name}
              </Link>
              {p.description && <p className="mt-0.5 max-w-52 truncate text-xs text-ink-mute">{p.description}</p>}
            </div>
          </div>
        );
      },
    },
    { key: "status", header: "Status", sortKey: "status", cell: (p) => <ProjectStatusBadge status={p.status} /> },
    { key: "priority", header: "Priority", sortKey: "priority", cell: (p) => <PriorityIndicator priority={p.priority} /> },
    {
      key: "manager",
      header: "Manager",
      cell: (p) => (
        <span className="flex min-w-0 items-center gap-2">
          <Avatar user={p.manager} size="xs" />
          <span className="truncate text-sm whitespace-nowrap">{fullName(p.manager)}</span>
        </span>
      ),
    },
    { key: "members", header: "Members", hideOnMobile: true, cell: (p) => (p.members.length ? <AvatarStack users={p.members} max={3} /> : <span className="text-ink-mute">—</span>) },
    {
      key: "progress",
      header: "Progress",
      className: "min-w-28",
      cell: (p) => {
        const done = percent(p.taskStats.completed, p.taskStats.total);
        return (
          <div className="w-28">
            <p className="tabular text-xs font-medium text-ink">{done}%</p>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-panel-3" role="progressbar" aria-valuenow={done} aria-valuemin={0} aria-valuemax={100} aria-label={`${p.name} progress`}>
              <div className={cn("h-full rounded-full", done === 100 ? "bg-lime" : "bg-cyan")} style={{ width: `${done}%` }} />
            </div>
          </div>
        );
      },
    },
    {
      key: "timeline",
      header: "Timeline",
      sortKey: "endDate",
      cell: (p) => (
        <span className="tabular block text-xs leading-relaxed whitespace-nowrap text-ink-dim">
          {formatDate(p.startDate)} –<br />
          {p.endDate ? formatDate(p.endDate) : "No end date"}
        </span>
      ),
    },
  ];

  const confirmDelete = async () => {
    if (!pending) return;
    try {
      await remove.mutateAsync(pending.id);
      toast.success("Project deleted", { description: pending.name });
      setPending(null);
    } catch (error) {
      notifyError(error, { title: "Delete failed" });
    }
  };

  const hasFilters = Boolean(params.search || Object.keys(params.filters).length);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-cyan/10 text-cyan" aria-hidden="true">
            <FolderOpen className="size-7" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-[1.75rem]">Projects</h1>
            <p className="mt-1 text-sm text-ink-mute">Manage all your projects, track progress and keep your team aligned.</p>
          </div>
        </div>
        <Can permission="projects.create">
          <ButtonLink href="/projects/new" size="lg" className="rounded-xl" icon={<Plus className="size-4" />}>
            New Project
          </ButtonLink>
        </Can>
      </div>

      <StatsRow />

      <div className={cn("grid gap-6", canViewActivity && "2xl:grid-cols-[minmax(0,1fr)_22rem]")}>
        <div className="min-w-0 [&>.hud-panel]:rounded-2xl">
          <DataTable
            caption="Projects"
            columns={columns}
            data={query.data?.items}
            meta={query.data?.meta}
            getRowId={(p) => p.id}
            isLoading={query.isLoading}
            isFetching={query.isFetching}
            error={query.error}
            onRetry={() => void query.refetch()}
            sortBy={params.sortBy}
            sortOrder={params.sortOrder}
            onSort={toggleSort}
            onPageChange={(page) => update({ page }, false)}
            onLimitChange={(limit) => update({ limit })}
            rowHref={(p) => `/projects/${p.id}`}
            toolbar={
              <TableToolbar
                search={params.search}
                onSearch={(search) => update({ search })}
                placeholder="Search projects…"
                filters={
                  <>
                    <Select
                      aria-label="Filter by status"
                      className="lg:w-40"
                      value={params.filters.status}
                      onValueChange={(status) => update({ status })}
                      allLabel="All statuses"
                      options={PROJECT_STATUSES.map((s) => ({ value: s, label: PROJECT_STATUS[s].label }))}
                    />
                    <Select
                      aria-label="Filter by priority"
                      className="lg:w-40"
                      value={params.filters.priority}
                      onValueChange={(priority) => update({ priority })}
                      allLabel="All priorities"
                      options={PRIORITIES.map((p) => ({ value: p, label: PRIORITY[p].label }))}
                    />
                    <UserSelect
                      id="filter-manager"
                      className="lg:w-48"
                      value={params.filters.managerId}
                      onChange={(managerId) => update({ managerId })}
                      allLabel="All managers"
                      placeholder="All managers"
                    />
                  </>
                }
              />
            }
            empty={
              hasFilters
                ? { title: "No projects match", description: "Adjust the search or filters." }
                : {
                    title: "No projects found",
                    description: "Create your first project to get started.",
                    action: can("projects.create") ? <ButtonLink href="/projects/new" size="sm">New project</ButtonLink> : undefined,
                  }
            }
            rowActions={(p) => (
              <RowActions label={`Actions for ${p.name}`}>
                <DropdownMenuItem asChild>
                  <Link href={`/projects/${p.id}`}>
                    <Eye className="size-4" /> View
                  </Link>
                </DropdownMenuItem>
                {can("projects.update") && canManage(p) && (
                  <DropdownMenuItem asChild>
                    <Link href={`/projects/${p.id}/edit`}>
                      <Pencil className="size-4" /> Edit
                    </Link>
                  </DropdownMenuItem>
                )}
                {can("projects.delete") && canManage(p) && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem icon={<Trash2 />} destructive onSelect={() => setPending(p)}>
                      Delete
                    </DropdownMenuItem>
                  </>
                )}
              </RowActions>
            )}
          />
        </div>

        {canViewActivity && (
          <aside className="grid content-start items-start gap-6 lg:grid-cols-2 2xl:grid-cols-1">
            <RecentProjectActivity />
            <TeamsCard />
          </aside>
        )}
      </div>

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        title="Delete project?"
        description={`${pending?.name ?? "This project"} and all of its tasks will be removed.`}
        confirmLabel="Delete project"
        loading={remove.isPending}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
