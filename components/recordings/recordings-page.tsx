"use client";

import { Plus, Search, Video } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth, usePermissions } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { InputWithIcon } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { useDebounce } from "@/hooks/use-debounce";
import { useProjects } from "@/hooks/use-projects";
import { useDeleteRecording, useRecordings } from "@/hooks/use-recordings";
import { useTableParams } from "@/hooks/use-table-params";
import { notifyError } from "@/lib/notify";
import { MODE_ORDER, RECORDING_MODES } from "@/lib/recording/media-support";
import type { Recording, RecordingListParams } from "@/types/recording";
import { useRecorder } from "./recorder-provider";
import { RecordingCard } from "./recording-card";
import { copyRecordingLink } from "./recording-meta";

const FILTERS = ["recordingType", "projectId", "mine"] as const;

/** Sort choices as one menu; each maps to sortBy + sortOrder. */
const SORTS = [
  { value: "createdAt:desc", label: "Newest first" },
  { value: "createdAt:asc", label: "Oldest first" },
  { value: "title:asc", label: "Title A–Z" },
  { value: "title:desc", label: "Title Z–A" },
  { value: "duration:desc", label: "Longest" },
  { value: "duration:asc", label: "Shortest" },
  { value: "fileSize:desc", label: "Largest file" },
];

function CardSkeleton() {
  return (
    <div className="hud-panel overflow-hidden rounded-2xl">
      <Skeleton className="aspect-video h-auto rounded-none" />
      <div className="space-y-3 p-4">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-5 w-24 rounded-full" />
        <Skeleton className="h-6 w-full" />
      </div>
    </div>
  );
}

export function RecordingsPage() {
  const { user: me } = useAuth();
  const { can } = usePermissions();
  const { openRecorder, available } = useRecorder();
  const { params, apiParams, update } = useTableParams(FILTERS, { limit: 12 });
  const query = useRecordings(apiParams as RecordingListParams);
  const projects = useProjects({ limit: 100, sortBy: "name", sortOrder: "asc" }, can("projects.view"));
  const remove = useDeleteRecording();
  const [pending, setPending] = useState<Recording | null>(null);

  const [search, setSearch] = useState(params.search);
  const debounced = useDebounce(search);
  useEffect(() => {
    if (debounced !== params.search) update({ search: debounced });
    // Only the debounced input drives the URL; the URL change itself must not loop back.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  const filtered = Boolean(params.search || params.filters.recordingType || params.filters.projectId || params.filters.mine);
  const items = query.data?.items ?? [];

  const confirmDelete = () => {
    if (!pending) return;
    remove.mutate(pending.id, {
      onSuccess: () => {
        toast.success("Recording deleted");
        setPending(null);
      },
      onError: (error) => notifyError(error, { title: "Delete failed" }),
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Recordings"
        description="Record your screen and camera, then share walkthroughs with your team."
        actions={
          available && (
            <Button onClick={openRecorder} icon={<Plus className="size-4" />}>
              New Recording
            </Button>
          )
        }
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="lg:w-80">
          <InputWithIcon icon={<Search className="size-4" />} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search recordings" aria-label="Search recordings" type="search" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:ml-auto lg:flex">
          <Select
            aria-label="Filter by type"
            value={params.filters.recordingType}
            onValueChange={(v) => update({ recordingType: v })}
            allLabel="All types"
            options={MODE_ORDER.map((t) => ({ value: t, label: RECORDING_MODES[t].label }))}
            className="lg:w-40"
          />
          {can("projects.view") && (
            <Select
              aria-label="Filter by project"
              value={params.filters.projectId}
              onValueChange={(v) => update({ projectId: v })}
              allLabel="All projects"
              options={(projects.data?.items ?? []).map((p) => ({ value: p.id, label: p.name }))}
              className="lg:w-44"
            />
          )}
          <Select
            aria-label="Filter by owner"
            value={params.filters.mine}
            onValueChange={(v) => update({ mine: v })}
            allLabel="Everyone's"
            options={[{ value: "true", label: "Only mine" }]}
            className="lg:w-36"
          />
          <Select
            aria-label="Sort recordings"
            value={`${params.sortBy}:${params.sortOrder}`}
            onValueChange={(v) => {
              const [sortBy, sortOrder] = (v ?? "createdAt:desc").split(":");
              update({ sortBy, sortOrder });
            }}
            options={SORTS}
            className="lg:w-40"
          />
        </div>
      </div>

      {query.isLoading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4" role="status" aria-label="Loading recordings">
          {Array.from({ length: 8 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : query.error ? (
        <ErrorState title="Recordings unavailable" error={query.error} onRetry={() => query.refetch()} />
      ) : items.length === 0 ? (
        <div className="hud-panel rounded-2xl">
          {filtered ? (
            <EmptyState title="No recordings match" description="Try a different search or clear the filters." icon={<Search />} />
          ) : (
            <EmptyState
              title="No recordings yet"
              description="Record your screen, a window, a tab or your camera. You'll review it before anything is uploaded."
              icon={<Video />}
              action={
                available && (
                  <Button onClick={openRecorder} icon={<Plus className="size-4" />}>
                    New Recording
                  </Button>
                )
              }
            />
          )}
        </div>
      ) : (
        <>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {items.map((r) => (
              <RecordingCard key={r.id} recording={r} meId={me?.id} onCopyLink={(rec) => void copyRecordingLink(rec.id)} onDelete={setPending} />
            ))}
          </div>
          {query.data && query.data.meta.total > query.data.meta.limit && (
            <Pagination meta={query.data.meta} onPageChange={(page) => update({ page }, false)} onLimitChange={(limit) => update({ limit })} pageSizes={[12, 24, 48]} />
          )}
        </>
      )}

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        title="Delete recording?"
        description={
          <>
            <span className="font-medium text-ink">{pending?.title}</span> will be permanently deleted for everyone who can see it.
          </>
        }
        confirmLabel="Delete"
        loading={remove.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
