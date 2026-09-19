"use client";

import { Activity, CheckCircle2, CircleDot, FolderKanban, FolderOpen, ListChecks, ListTodo, PieChart, Plus, UserCheck, Users } from "lucide-react";
import Link from "next/link";
import { useAuth, usePermissions } from "@/components/auth/auth-provider";
import { ActivityFeed } from "@/components/activity/activity-feed";
import { TaskRows } from "@/components/tasks/task-list-compact";
import { AvatarStack } from "@/components/ui/avatar";
import { ProjectStatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { XpBar } from "@/components/ui/xp-bar";
import { useDashboard } from "@/hooks/use-dashboard";
import { percent } from "@/lib/utils";
import { ProjectStatusBars, TaskStatusDonut } from "./charts";
import { StatTile } from "./stat-tile";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export function DashboardView() {
  const { user } = useAuth();
  const { can } = usePermissions();
  const { data, isLoading, error, refetch } = useDashboard();

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${greeting()}, ${user?.firstName ?? "there"}`}
        description="Here's an overview of your projects and tasks."
        actions={
          <>
            {can("tasks.create") && (
              <ButtonLink href="/tasks/new" variant="secondary" icon={<Plus className="size-4" />}>
                New task
              </ButtonLink>
            )}
            {can("projects.create") && (
              <ButtonLink href="/projects/new" icon={<Plus className="size-4" />}>
                New project
              </ButtonLink>
            )}
          </>
        }
      />

      {error && !data ? (
        <div className="hud-panel clip-corner">
          <ErrorState message={error.message} onRetry={() => void refetch()} />
        </div>
      ) : isLoading || !data ? (
        <DashboardSkeleton />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3 2xl:grid-cols-6">
            <StatTile label="Total users" value={data.stats.totalUsers} icon={Users} tone="cyan" caption={data.stats.totalUsers === null ? "No access" : "All accounts"} />
            <StatTile
              label="Active users"
              value={data.stats.activeUsers}
              icon={UserCheck}
              tone="lime"
              ratio={data.stats.totalUsers ? percent(data.stats.activeUsers ?? 0, data.stats.totalUsers) : undefined}
              caption={data.stats.totalUsers ? `${percent(data.stats.activeUsers ?? 0, data.stats.totalUsers)}% active` : "No access"}
            />
            <StatTile label="Total projects" value={data.stats.totalProjects} icon={FolderKanban} tone="violet" caption="All projects" />
            <StatTile
              label="Active projects"
              value={data.stats.activeProjects}
              icon={CircleDot}
              tone="magenta"
              ratio={percent(data.stats.activeProjects, data.stats.totalProjects)}
              caption="In progress"
            />
            <StatTile label="Total tasks" value={data.stats.totalTasks} icon={ListChecks} tone="amber" caption="All tasks" />
            <StatTile
              label="Completed tasks"
              value={data.stats.completedTasks}
              icon={CheckCircle2}
              tone="lime"
              ratio={percent(data.stats.completedTasks, data.stats.totalTasks)}
              caption={`${percent(data.stats.completedTasks, data.stats.totalTasks)}% completed`}
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <Panel title="Tasks by status" icon={<PieChart />}>
              <TaskStatusDonut data={data.tasksByStatus} />
            </Panel>
            <Panel title="Projects by status" icon={<FolderKanban />}>
              <ProjectStatusBars data={data.projectsByStatus} />
            </Panel>
            <Panel
              title="My open tasks"
              icon={<ListTodo />}
              actions={
                can("tasks.view") && (
                  <Link href="/tasks?assigneeId=me" className="text-xs font-medium text-cyan hover:underline">
                    View all
                  </Link>
                )
              }
            >
              {data.myTasks.length === 0 ? (
                <EmptyState title="No open tasks" description="Nothing is assigned to you right now." className="py-6" />
              ) : (
                <TaskRows tasks={data.myTasks} />
              )}
            </Panel>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
            <Panel
              title="Recent projects"
              icon={<FolderOpen />}
              bodyClassName="p-0"
              actions={
                <Link href="/projects" className="text-xs font-medium text-cyan hover:underline">
                  All projects
                </Link>
              }
            >
              {data.recentProjects.length === 0 ? (
                <EmptyState
                  title="No projects found"
                  description="Create your first project to get started."
                  action={can("projects.create") ? <ButtonLink href="/projects/new" size="sm">New project</ButtonLink> : undefined}
                />
              ) : (
                <ul className="divide-y divide-line/60">
                  {data.recentProjects.map((p) => (
                    <li key={p.id}>
                      <Link href={`/projects/${p.id}`} className="group grid gap-3 px-5 py-4 transition-colors hover:bg-panel-2 sm:grid-cols-[1fr_auto] sm:items-center">
                        <div className="min-w-0 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="truncate text-sm font-medium text-ink group-hover:text-cyan">{p.name}</span>
                            <ProjectStatusBadge status={p.status} />
                          </div>
                          <XpBar value={percent(p.taskStats.completed, p.taskStats.total)} label={`${p.name} progress`} />
                        </div>
                        <div className="flex items-center gap-4 sm:justify-end">
                          <AvatarStack users={[p.manager, ...p.members]} />
                          <span className="tabular text-xs text-ink-mute">
                            {p.taskStats.completed}/{p.taskStats.total}
                          </span>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
            <Panel
              title="Recent activity"
              icon={<Activity />}
              actions={
                can("activity_logs.view") && (
                  <Link href="/activity" className="text-xs font-medium text-cyan hover:underline">
                    View log
                  </Link>
                )
              }
            >
              {!can("activity_logs.view") ? (
                <EmptyState title="No access" description="You don't have permission to view activity logs." className="py-6" />
              ) : data.recentActivity.length === 0 ? (
                <EmptyState title="No activity yet" description="Actions will appear here." className="py-6" />
              ) : (
                <ActivityFeed items={data.recentActivity} />
              )}
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading dashboard">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3 2xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-72" />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Skeleton className="h-96" />
        <Skeleton className="h-96" />
      </div>
    </div>
  );
}
