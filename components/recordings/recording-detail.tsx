"use client";

import { ArrowLeft, Download, Link2, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/auth-provider";
import { Avatar } from "@/components/ui/avatar";
import { Button, buttonClasses } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataRow, Panel } from "@/components/ui/panel";
import { PageSkeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { useDeleteRecording, useRecording } from "@/hooks/use-recordings";
import { notifyError } from "@/lib/notify";
import { formatBytes } from "@/lib/recording/media-support";
import { formatDateTime, fullName } from "@/lib/utils";
import { copyRecordingLink, formatDuration, RecordingTypeBadge } from "./recording-meta";
import { RecordingPlayer } from "./recording-player";

export function RecordingDetail({ id }: { id: string }) {
  const router = useRouter();
  const { user: me } = useAuth();
  const query = useRecording(id);
  const remove = useDeleteRecording();
  const [confirming, setConfirming] = useState(false);

  if (query.isLoading) return <PageSkeleton />;
  if (query.error || !query.data) return <ErrorState title="Recording unavailable" error={query.error} onRetry={() => query.refetch()} />;
  const r = query.data;

  const onDelete = () =>
    remove.mutate(r.id, {
      onSuccess: () => {
        toast.success("Recording deleted");
        router.push("/recordings");
      },
      onError: (error) => notifyError(error, { title: "Delete failed" }),
    });

  return (
    <div className="space-y-6">
      <Link href="/recordings" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-dim hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden="true" /> Recordings
      </Link>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-5">
          <RecordingPlayer src={r.playbackUrl} poster={r.thumbnailUrl} onSourceExpired={() => void query.refetch()} className="shadow-[var(--shadow-card)]" />
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight break-words text-ink">{r.title}</h1>
              <div className="flex flex-wrap items-center gap-2 text-sm text-ink-mute">
                <Avatar user={r.owner} size="xs" />
                <span>{r.owner.id === me?.id ? "You" : fullName(r.owner)}</span>
                <span aria-hidden="true">·</span>
                <time dateTime={r.createdAt}>{formatDateTime(r.createdAt)}</time>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <a href={r.downloadUrl} download className={buttonClasses("secondary")}>
                <Download className="size-4" aria-hidden="true" /> Download
              </a>
              <Button variant="secondary" icon={<Link2 className="size-4" />} onClick={() => void copyRecordingLink(r.id)}>
                Copy link
              </Button>
              {r.canDelete && (
                <Button variant="ghost" className="text-danger hover:bg-danger/10 hover:text-danger" icon={<Trash2 className="size-4" />} onClick={() => setConfirming(true)}>
                  Delete
                </Button>
              )}
            </div>
          </div>
          {r.description ? (
            <p className="text-[0.9375rem] leading-relaxed whitespace-pre-line text-ink-dim">{r.description}</p>
          ) : (
            <p className="text-sm text-ink-mute italic">No description.</p>
          )}
        </div>

        <Panel title="Details" className="h-fit">
          <dl>
            <DataRow label="Type">
              <RecordingTypeBadge type={r.recordingType} />
            </DataRow>
            <DataRow label="Duration">
              <span className="tabular">{formatDuration(r.duration)}</span>
            </DataRow>
            <DataRow label="File size">
              <span className="tabular">{formatBytes(r.fileSize)}</span>
            </DataRow>
            <DataRow label="Format">{r.mimeType.replace("video/", "").toUpperCase()}</DataRow>
            <DataRow label="Project">
              {r.project ? (
                <Link href={`/projects/${r.project.id}`} className="text-cyan hover:underline">
                  {r.project.name}
                </Link>
              ) : (
                <span className="text-ink-mute">Private (no project)</span>
              )}
            </DataRow>
            <DataRow label="Owner">
              <span className="inline-flex items-center gap-2">
                <Avatar user={r.owner} size="xs" />
                {fullName(r.owner)}
              </span>
            </DataRow>
            <DataRow label="Created">{formatDateTime(r.createdAt)}</DataRow>
            {r.tags.length > 0 && (
              <DataRow label="Tags">
                <span className="flex flex-wrap justify-end gap-1">
                  {r.tags.map((t) => (
                    <span key={t} className="rounded-full bg-cyan/10 px-2 py-0.5 text-xs font-medium text-cyan">
                      {t}
                    </span>
                  ))}
                </span>
              </DataRow>
            )}
          </dl>
        </Panel>
      </div>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Delete recording?"
        description={
          <>
            <span className="font-medium text-ink">{r.title}</span> will be permanently deleted for everyone who can see it.
          </>
        }
        confirmLabel="Delete"
        loading={remove.isPending}
        onConfirm={onDelete}
      />
    </div>
  );
}
