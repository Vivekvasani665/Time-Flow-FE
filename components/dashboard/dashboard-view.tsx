"use client";

import {
  Activity,
  ArrowRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  ClipboardCheck,
  ClipboardList,
  Clock,
  FilePlus2,
  FolderKanban,
  FolderOpen,
  ListChecks,
  ListTree,
  PieChart,
  PlusCircle,
  Settings,
  SquareCheckBig,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { ActivityFeed } from "@/components/activity/activity-feed";
import { useAuth, usePermissions } from "@/components/auth/auth-provider";
import { ProjectStatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { TONE } from "@/components/ui/tone";
import { useActivityStats } from "@/hooks/use-activity";
import { useDashboard } from "@/hooks/use-dashboard";
import { PROJECT_STATUS, actionLabel } from "@/lib/labels";
import { cn, percent } from "@/lib/utils";
import type { DashboardData } from "@/types/api";
import { ActionBars, ActivityTrend } from "./charts";
import { StatTile } from "./stat-tile";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

const today = () => new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });

const shortDate = (value: string) => new Date(value).toLocaleDateString(undefined, { month: "short", day: "2-digit" });

/** Dashboard card: title row (optional icon, subtitle, actions) above free-form content. */
function Card({ title, subtitle, icon: Icon, actions, className, children }: { title: string; subtitle?: string; icon?: LucideIcon; actions?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <section className={cn("hud-panel flex flex-col rounded-2xl p-5", className)}>
      <header className="mb-5 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          {Icon && <Icon className="mt-0.5 size-5 shrink-0 text-cyan" aria-hidden="true" />}
          <div className="min-w-0">
            <h2 className="truncate font-semibold text-ink">{title}</h2>
            {subtitle && <p className="mt-0.5 truncate text-xs text-ink-mute">{subtitle}</p>}
          </div>
        </div>
        {actions}
      </header>
      {children}
    </section>
  );
}

function ViewAll({ href }: { href: string }) {
  return (
    <Link href={href} className="flex shrink-0 items-center gap-1 text-xs font-medium text-cyan hover:underline">
      View all <ArrowRight className="size-3" aria-hidden="true" />
    </Link>
  );
}

const RANGES = [
  { value: "7", label: "Last 7 days" },
  { value: "14", label: "Last 14 days" },
  { value: "30", label: "Last 30 days" },
];

function ActivityCards() {
  const [range, setRange] = useState("7");
  const days = Number(range);
  const from = new Date(Date.now() - (days - 1) * 86_400_000).toISOString().slice(0, 10);
  const query = useActivityStats({ from });
  const stats = query.data;

  return (
    <>
      <Card
        title="Activity Trend"
        subtitle={stats ? `${stats.total.toLocaleString()} activities in the last ${days} days` : `Total activities in the last ${days} days`}
        icon={BarChart3}
        className="lg:col-span-2 2xl:col-span-5"
        actions={<Select aria-label="Time range" className="h-8 w-36 text-xs" value={range} onValueChange={(v) => setRange(v ?? "7")} options={RANGES} />}
      >
        {query.isLoading ? (
          <Skeleton className="h-56" />
        ) : query.error && !stats ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} className="py-6" />
        ) : stats ? (
          <div className={cn("transition-opacity", query.isFetching && "opacity-70")}>
            <ActivityTrend days={stats.days} />
          </div>
        ) : null}
      </Card>

      <Card title="Activity by Action" icon={ListTree} className="2xl:col-span-4" subtitle={`Last ${days} days`}>
        {query.isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-5" />
            ))}
          </div>
        ) : stats && stats.byAction.length > 0 ? (
          <ActionBars data={stats.byAction} />
        ) : stats ? (
          <p className="py-6 text-center text-sm text-ink-mute">No activity in this range.</p>
        ) : null}
      </Card>
    </>
  );
}

const QUICK_ACTIONS: { label: string; href: string; icon: LucideIcon; permission?: string; className: string }[] = [
  { label: "New Project", href: "/projects/new", icon: PlusCircle, permission: "projects.create", className: "bg-cyan/10 text-cyan hover:bg-cyan/15" },
  { label: "New Task", href: "/tasks/new", icon: FilePlus2, permission: "tasks.create", className: "bg-lime/10 text-lime hover:bg-lime/15" },
  { label: "Add User", href: "/users/new", icon: UserPlus, permission: "users.create", className: "bg-blue/10 text-blue hover:bg-blue/15" },
  { label: "Settings", href: "/settings", icon: Settings, className: "bg-magenta/10 text-magenta hover:bg-magenta/15" },
];

function QuickActions({ can }: { can: (permission: string) => boolean }) {
  const actions = QUICK_ACTIONS.filter((a) => !a.permission || can(a.permission));
  return (
    <Card title="Quick Actions" className="2xl:col-span-3">
      <div className="grid flex-1 grid-cols-2 gap-3">
        {actions.map(({ label, href, icon: Icon, className }) => (
          <Link key={href} href={href} className={cn("flex min-h-24 flex-col items-center justify-center gap-2.5 rounded-xl p-3 text-sm font-medium transition-colors", className)}>
            <Icon className="size-7" aria-hidden="true" />
            {label}
          </Link>
        ))}
      </div>
    </Card>
  );
}

function RecentProjects({ projects, canCreate }: { projects: DashboardData["recentProjects"]; canCreate: boolean }) {
  return (
    <Card title="Recent Projects" icon={FolderOpen} className="lg:col-span-2 2xl:col-span-5" actions={<ViewAll href="/projects" />}>
      {projects.length === 0 ? (
        <EmptyState
          title="No projects found"
          description="Create your first project to get started."
          action={canCreate ? <ButtonLink href="/projects/new" size="sm">New project</ButtonLink> : undefined}
          className="py-6"
        />
      ) : (
        <ul className="-mx-2 space-y-1">
          {projects.map((p) => {
            const done = percent(p.taskStats.completed, p.taskStats.total);
            const tone = TONE[PROJECT_STATUS[p.status].tone];
            return (
              <li key={p.id}>
                <Link
                  href={`/projects/${p.id}`}
                  className="group grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-panel-2 sm:grid-cols-[auto_minmax(0,1fr)_7.5rem_auto_5.5rem]"
                >
                  <span className={cn("flex size-8 items-center justify-center rounded-lg", tone.bg, tone.text)} aria-hidden="true">
                    <FolderKanban className="size-4" />
                  </span>
                  <span className="truncate text-sm font-medium text-ink group-hover:text-cyan">{p.name}</span>
                  <span className="hidden items-center gap-2.5 sm:flex">
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-panel-3" aria-hidden="true">
                      <span className="block h-full rounded-full bg-cyan" style={{ width: `${done}%` }} />
                    </span>
                    <span className="tabular w-9 text-right text-xs text-ink-mute">{done}%</span>
                  </span>
                  <ProjectStatusBadge status={p.status} />
                  <span className="tabular hidden text-right text-xs text-ink-mute sm:block">{p.endDate ? `Due ${shortDate(p.endDate)}` : "No due date"}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function StayProductive({ openTasks, canViewTasks }: { openTasks: number; canViewTasks: boolean }) {
  return (
    <section className="hud-panel rounded-2xl p-3 2xl:col-span-3">
      <div className="flex h-full flex-col items-center justify-center rounded-xl bg-cyan/[0.06] px-5 py-7 text-center">
        <span className="relative mb-4 flex size-16 items-center justify-center rounded-2xl border border-line bg-panel text-cyan shadow-sm" aria-hidden="true">
          <ClipboardList className="size-8" strokeWidth={1.5} />
          <span className="absolute -right-2 -bottom-2 flex size-7 items-center justify-center rounded-full bg-cyan text-white ring-4 ring-panel">
            <Clock className="size-3.5" />
          </span>
        </span>
        <h2 className="text-lg font-semibold text-cyan">Stay productive!</h2>
        <p className="mt-1.5 max-w-xs text-sm text-ink-mute">
          {openTasks === 0 ? "You have no open tasks right now. Nice work." : `You have ${openTasks} open ${openTasks === 1 ? "task" : "tasks"} assigned to you.`}
        </p>
        {canViewTasks && (
          <ButtonLink href="/tasks?assigneeId=me" className="mt-5 px-6">
            View my tasks <ArrowRight className="size-4" aria-hidden="true" />
          </ButtonLink>
        )}
      </div>
    </section>
  );
}

export function DashboardView() {
  const { user } = useAuth();
  const { can } = usePermissions();
  const { data, isLoading, error, refetch } = useDashboard();
  const canViewActivity = can("activity_logs.view");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-bold tracking-tight text-ink sm:text-[1.75rem]">
            <span aria-hidden="true">👋</span>
            {greeting()}, {user?.firstName ?? "there"}!
          </h1>
          <p className="mt-1.5 text-ink-mute">Here&apos;s what&apos;s happening with your projects and team today.</p>
        </div>
        <p className="flex h-10 items-center gap-2 rounded-xl border border-line bg-panel px-3.5 text-sm font-medium text-ink shadow-[var(--shadow-card)]">
          <CalendarDays className="size-4 text-ink-mute" aria-hidden="true" />
          {today()}
        </p>
      </div>

      {error && !data ? (
        <div className="hud-panel clip-corner">
          <ErrorState error={error} onRetry={() => refetch()} />
        </div>
      ) : isLoading || !data ? (
        <DashboardSkeleton />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <StatTile
              label="Total Users"
              value={data.stats.totalUsers}
              icon={Users}
              tone="cyan"
              accent={Users}
              caption={data.stats.totalUsers === null ? "No access" : `${data.stats.activeUsers ?? 0} active`}
            />
            <StatTile label="Total Projects" value={data.stats.totalProjects} icon={CheckCircle2} tone="lime" accent={BarChart3} caption={`${data.stats.activeProjects} in progress`} />
            <StatTile label="Total Tasks" value={data.stats.totalTasks} icon={ClipboardCheck} tone="blue" accent={ListChecks} caption={`${data.myTasks.length} assigned to you`} />
            <StatTile
              label="Active Projects"
              value={data.stats.activeProjects}
              icon={CircleAlert}
              tone="magenta"
              accent={PieChart}
              caption={`${percent(data.stats.activeProjects, data.stats.totalProjects)}% of projects`}
            />
            <StatTile
              label="Completed Tasks"
              value={data.stats.completedTasks}
              icon={SquareCheckBig}
              tone="amber"
              accent={Activity}
              caption={`${percent(data.stats.completedTasks, data.stats.totalTasks)}% completed`}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2 2xl:grid-cols-12">
            {canViewActivity ? (
              <ActivityCards />
            ) : (
              <Card title="Activity" icon={BarChart3} className="lg:col-span-2 2xl:col-span-9">
                <EmptyState title="No access" description="You don't have permission to view activity logs." className="py-6" />
              </Card>
            )}
            <QuickActions can={can} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2 2xl:grid-cols-12">
            <RecentProjects projects={data.recentProjects} canCreate={can("projects.create")} />
            <Card title="Recent Activity" icon={Activity} className="2xl:col-span-4" actions={canViewActivity && <ViewAll href="/activity" />}>
              {!canViewActivity ? (
                <EmptyState title="No access" description="You don't have permission to view activity logs." className="py-6" />
              ) : data.recentActivity.length === 0 ? (
                <EmptyState title="No activity yet" description="Actions will appear here." className="py-6" />
              ) : (
                <ActivityFeed items={data.recentActivity.slice(0, 5)} describeAction={actionLabel} />
              )}
            </Card>
            <StayProductive openTasks={data.myTasks.length} canViewTasks={can("tasks.view")} />
          </div>
        </>
      )}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading dashboard">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2 2xl:grid-cols-12">
        <Skeleton className="h-80 rounded-2xl lg:col-span-2 2xl:col-span-5" />
        <Skeleton className="h-80 rounded-2xl 2xl:col-span-4" />
        <Skeleton className="h-80 rounded-2xl 2xl:col-span-3" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2 2xl:grid-cols-12">
        <Skeleton className="h-80 rounded-2xl lg:col-span-2 2xl:col-span-5" />
        <Skeleton className="h-80 rounded-2xl 2xl:col-span-4" />
        <Skeleton className="h-80 rounded-2xl 2xl:col-span-3" />
      </div>
    </div>
  );
}
