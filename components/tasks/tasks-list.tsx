"use client";

import { CalendarClock, Eye, ListPlus, Pencil, Trash2, UserCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth, usePermissions } from "@/components/auth/auth-provider";
import { Can } from "@/components/auth/can";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { RowActions } from "@/components/data-table/row-actions";
import { TableToolbar } from "@/components/data-table/table-toolbar";
import { UserSelect } from "@/components/forms/user-select";
import { Avatar } from "@/components/ui/avatar";
import { PriorityIndicator, TaskStatusBadge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { TONE } from "@/components/ui/tone";
import { useProjects } from "@/hooks/use-projects";
import { useTableParams } from "@/hooks/use-table-params";
import { useChangeTaskStatus, useDeleteTask, useTasks } from "@/hooks/use-tasks";
import { PRIORITIES, PRIORITY, TASK_STATUS, TASK_STATUSES } from "@/lib/labels";
import { cn, formatDate, fullName, isOverdue } from "@/lib/utils";
import type { Task, TaskListParams } from "@/types/api";
import { notifyError } from "@/lib/notify";

const FILTERS = ["status", "priority", "projectId", "assigneeId"] as const;

export function TasksList() {
  const { user: me } = useAuth();
  const { can } = usePermissions();
  const { params, apiParams, update, toggleSort } = useTableParams(FILTERS);
  const query = useTasks(apiParams as TaskListParams);
  const projects = useProjects({ limit: 100, sortBy: "name", sortOrder: "asc" }, can("projects.view"));
  const remove = useDeleteTask();
  const changeStatus = useChangeTaskStatus();
  const [pending, setPending] = useState<Task | null>(null);
  const mineOnly = params.filters.assigneeId === "me";

  const columns: Column<Task>[] = [
    {
      key: "title",
      header: "Task",
      sortKey: "title",
      primary: true,
      className: "min-w-60",
      cell: (t) => (
        <div className="min-w-0">
          <Link href={`/tasks/${t.id}`} onClick={(e) => e.stopPropagation()} className="block truncate font-medium text-ink hover:text-cyan">
            {t.title}
          </Link>
          <span className="block truncate text-xs text-ink-mute">{t.project.name}</span>
        </div>
      ),
    },
    { key: "status", header: "Status", sortKey: "status", cell: (t) => <TaskStatusBadge status={t.status} /> },
    { key: "priority", header: "Priority", sortKey: "priority", cell: (t) => <PriorityIndicator priority={t.priority} /> },
    {
      key: "assignee",
      header: "Assignee",
      cell: (t) => (
        <span className="flex min-w-0 items-center gap-2">
          <Avatar user={t.assignee} size="xs" />
          <span className={cn("truncate text-sm", !t.assignee && "text-ink-mute")}>{fullName(t.assignee)}</span>
        </span>
      ),
    },
    {
      key: "dueDate",
      header: "Due",
      sortKey: "dueDate",
      cell: (t) => {
        const overdue = isOverdue(t.dueDate, t.status);
        return (
          <span className={cn("tabular inline-flex items-center gap-1.5 text-sm whitespace-nowrap", overdue ? "text-danger" : "text-ink-dim")}>
            <CalendarClock className="size-3.5 opacity-70" />
            {formatDate(t.dueDate)}
          </span>
        );
      },
    },
    { key: "createdAt", header: "Created", sortKey: "createdAt", hideOnMobile: true, cell: (t) => <span className="tabular text-sm text-ink-dim">{formatDate(t.createdAt)}</span> },
  ];

  const confirmDelete = async () => {
    if (!pending) return;
    try {
      await remove.mutateAsync(pending.id);
      toast.success("Task deleted", { description: pending.title });
      setPending(null);
    } catch (error) {
      notifyError(error, { title: "Delete failed" });
    }
  };

  const hasFilters = Boolean(params.search || Object.keys(params.filters).length);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tasks"
        description="Track work across all projects. Status changes are saved immediately."
        actions={
          <>
            <Button
              variant="secondary"
              icon={<UserCheck className="size-4" />}
              onClick={() => update({ assigneeId: mineOnly ? undefined : "me" })}
              aria-pressed={mineOnly}
              className={cn(mineOnly && "border-cyan/40 bg-cyan/10 text-cyan hover:bg-cyan/15")}
            >
              My tasks
            </Button>
            <Can permission="tasks.create">
              <ButtonLink href="/tasks/new" icon={<ListPlus className="size-4" />}>
                New task
              </ButtonLink>
            </Can>
          </>
        }
      />
      <DataTable
        caption="Tasks"
        columns={columns}
        data={query.data?.items}
        meta={query.data?.meta}
        getRowId={(t) => t.id}
        isLoading={query.isLoading}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        sortBy={params.sortBy}
        sortOrder={params.sortOrder}
        onSort={toggleSort}
        onPageChange={(page) => update({ page }, false)}
        onLimitChange={(limit) => update({ limit })}
        rowHref={(t) => `/tasks/${t.id}`}
        toolbar={
          <TableToolbar
            search={params.search}
            onSearch={(search) => update({ search })}
            placeholder="Search tasks…"
            filters={
              <>
                <Select
                  aria-label="Filter by status"
                  className="lg:w-40"
                  value={params.filters.status}
                  onValueChange={(status) => update({ status })}
                  allLabel="All statuses"
                  options={TASK_STATUSES.map((s) => ({ value: s, label: TASK_STATUS[s].label }))}
                />
                <Select
                  aria-label="Filter by priority"
                  className="lg:w-40"
                  value={params.filters.priority}
                  onValueChange={(priority) => update({ priority })}
                  allLabel="All priorities"
                  options={PRIORITIES.map((p) => ({ value: p, label: PRIORITY[p].label }))}
                />
                {can("projects.view") && (
                  <Select
                    aria-label="Filter by project"
                    className="lg:w-48"
                    value={params.filters.projectId}
                    onValueChange={(projectId) => update({ projectId })}
                    allLabel="All projects"
                    options={(projects.data?.items ?? []).map((p) => ({ value: p.id, label: p.name }))}
                  />
                )}
                {!mineOnly && (
                  <UserSelect
                    id="filter-assignee"
                    className="lg:w-48"
                    value={params.filters.assigneeId}
                    onChange={(assigneeId) => update({ assigneeId })}
                    allLabel="All assignees"
                    placeholder="All assignees"
                  />
                )}
              </>
            }
          />
        }
        empty={
          hasFilters
            ? { title: "No tasks match", description: "Adjust the search or filters." }
            : {
                title: "No tasks found",
                description: "Create your first task to get started.",
                action: can("tasks.create") ? <ButtonLink href="/tasks/new" size="sm">New task</ButtonLink> : undefined,
              }
        }
        rowActions={(t) => (
          <RowActions label={`Actions for ${t.title}`}>
            <DropdownMenuItem asChild>
              <Link href={`/tasks/${t.id}`}>
                <Eye className="size-4" /> View
              </Link>
            </DropdownMenuItem>
            {can("tasks.update") && (
              <>
                <DropdownMenuItem asChild>
                  <Link href={`/tasks/${t.id}/edit`}>
                    <Pencil className="size-4" /> Edit
                  </Link>
                </DropdownMenuItem>
                {(can("tasks.view_all") || t.assignee?.id === me?.id || t.createdBy?.id === me?.id) && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>Set status</DropdownMenuLabel>
                    {TASK_STATUSES.filter((s) => s !== t.status).map((s) => (
                      <DropdownMenuItem
                        key={s}
                        onSelect={() =>
                          changeStatus.mutate(
                            { id: t.id, status: s },
                            {
                              onSuccess: () => toast.success("Status updated", { description: `${t.title} → ${TASK_STATUS[s].label}` }),
                              onError: (error) => notifyError(error, { title: "Status change failed" }),
                            },
                          )
                        }
                      >
                        <span className={cn("size-2 rounded-full", TONE[TASK_STATUS[s].tone].dot)} aria-hidden="true" />
                        {TASK_STATUS[s].label}
                      </DropdownMenuItem>
                    ))}
                  </>
                )}
              </>
            )}
            <Can permission="tasks.delete">
              <DropdownMenuSeparator />
              <DropdownMenuItem icon={<Trash2 />} destructive onSelect={() => setPending(t)}>
                Delete
              </DropdownMenuItem>
            </Can>
          </RowActions>
        )}
      />
      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        title="Delete task?"
        description={`"${pending?.title ?? ""}" will be removed.`}
        confirmLabel="Delete task"
        loading={remove.isPending}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
