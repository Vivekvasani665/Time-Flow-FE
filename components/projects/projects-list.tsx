"use client";

import { Eye, FolderPlus, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth, usePermissions } from "@/components/auth/auth-provider";
import { Can } from "@/components/auth/can";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { RowActions } from "@/components/data-table/row-actions";
import { TableToolbar } from "@/components/data-table/table-toolbar";
import { UserSelect } from "@/components/forms/user-select";
import { Avatar, AvatarStack } from "@/components/ui/avatar";
import { PriorityIndicator, ProjectStatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { XpBar } from "@/components/ui/xp-bar";
import { useDeleteProject, useProjects } from "@/hooks/use-projects";
import { useTableParams } from "@/hooks/use-table-params";
import { isApiError } from "@/lib/api/client";
import { PRIORITIES, PRIORITY, PROJECT_STATUS, PROJECT_STATUSES } from "@/lib/labels";
import { formatDate, fullName, percent } from "@/lib/utils";
import type { Project, ProjectListParams } from "@/types/api";

const FILTERS = ["status", "priority", "managerId"] as const;

export function ProjectsList() {
  const { user: me } = useAuth();
  const { can } = usePermissions();
  const { params, apiParams, update, toggleSort } = useTableParams(FILTERS);
  const query = useProjects(apiParams as ProjectListParams);
  const remove = useDeleteProject();
  const [pending, setPending] = useState<Project | null>(null);

  const canManage = (p: Project) => can("projects.view_all") || p.manager.id === me?.id;

  const columns: Column<Project>[] = [
    {
      key: "name",
      header: "Project",
      sortKey: "name",
      primary: true,
      className: "min-w-64",
      cell: (p) => (
        <div className="min-w-0">
          <Link href={`/projects/${p.id}`} onClick={(e) => e.stopPropagation()} className="block truncate font-medium text-ink hover:text-cyan">
            {p.name}
          </Link>
          <div className="mt-1.5 max-w-56">
            <XpBar value={percent(p.taskStats.completed, p.taskStats.total)} label={`${p.name} progress`} />
          </div>
        </div>
      ),
    },
    { key: "status", header: "Status", sortKey: "status", cell: (p) => <ProjectStatusBadge status={p.status} /> },
    { key: "priority", header: "Priority", sortKey: "priority", cell: (p) => <PriorityIndicator priority={p.priority} /> },
    {
      key: "manager",
      header: "Manager",
      cell: (p) => (
        <span className="flex min-w-0 items-center gap-2">
          <Avatar user={p.manager} size="xs" />
          <span className="truncate text-sm">{fullName(p.manager)}</span>
        </span>
      ),
    },
    { key: "members", header: "Members", hideOnMobile: true, cell: (p) => (p.members.length ? <AvatarStack users={p.members} /> : <span className="text-ink-mute">—</span>) },
    {
      key: "timeline",
      header: "Timeline",
      sortKey: "endDate",
      cell: (p) => (
        <span className="tabular text-sm whitespace-nowrap text-ink-dim">
          {formatDate(p.startDate)} – {formatDate(p.endDate)}
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
      toast.error("Delete failed", { description: isApiError(error) ? error.message : "Try again." });
    }
  };

  const hasFilters = Boolean(params.search || Object.keys(params.filters).length);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        description="All projects, their teams and progress."
        actions={
          <Can permission="projects.create">
            <ButtonLink href="/projects/new" icon={<FolderPlus className="size-4" />}>
              New project
            </ButtonLink>
          </Can>
        }
      />
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
                  className="lg:w-52"
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
