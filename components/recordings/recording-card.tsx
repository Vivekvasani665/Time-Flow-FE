"use client";

import { FolderKanban, Link2, MoreHorizontal, Play, Trash2 } from "lucide-react";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn, fullName, timeAgo } from "@/lib/utils";
import type { Recording } from "@/types/recording";
import { formatDuration, RECORDING_TYPE_ICON, RecordingTypeBadge } from "./recording-meta";

type Props = {
  recording: Recording;
  /** The signed-in user, to say "You" instead of their own name. */
  meId?: string;
  onCopyLink: (recording: Recording) => void;
  onDelete: (recording: Recording) => void;
};

export function RecordingCard({ recording, meId, onCopyLink, onDelete }: Props) {
  const href = `/recordings/${recording.id}`;
  const Icon = RECORDING_TYPE_ICON[recording.recordingType];
  const mine = recording.owner.id === meId;

  return (
    <article className="hud-panel group flex flex-col overflow-hidden rounded-2xl transition-shadow hover:shadow-[var(--shadow-overlay)]">
      <Link href={href} className="relative block aspect-video overflow-hidden bg-panel-3 focus-visible:outline-offset-[-2px]" aria-label={`Play ${recording.title}`}>
        {recording.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL from object storage
          <img src={recording.thumbnailUrl} alt="" loading="lazy" className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
        ) : (
          <div className="flex size-full items-center justify-center bg-[linear-gradient(135deg,color-mix(in_oklab,var(--color-cyan)_14%,var(--color-panel-3)),var(--color-panel-3))]">
            <Icon className="size-10 text-cyan/60" aria-hidden="true" />
          </div>
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/25">
          <span className="flex size-12 items-center justify-center rounded-full bg-white/90 text-ink opacity-90 shadow-lg transition group-hover:scale-105 group-hover:opacity-100">
            <Play className="ml-0.5 size-5 fill-current" aria-hidden="true" />
          </span>
        </span>
        {recording.duration !== null && (
          <span className="tabular absolute right-2 bottom-2 rounded-md bg-black/75 px-1.5 py-0.5 text-xs font-medium text-white">{formatDuration(recording.duration)}</span>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start gap-2">
          <h3 className="line-clamp-2 min-w-0 flex-1 text-[0.9375rem] leading-snug font-semibold text-ink">
            <Link href={href} className="hover:text-cyan">
              {recording.title}
            </Link>
          </h3>
          <DropdownMenu>
            <DropdownMenuTrigger className="-mt-1 -mr-1.5 flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-ink-mute hover:bg-panel-3 hover:text-ink" aria-label={`Actions for ${recording.title}`}>
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem asChild>
                <Link href={href}>
                  <Play className="size-4" /> Watch
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem icon={<Link2 />} onSelect={() => onCopyLink(recording)}>
                Copy link
              </DropdownMenuItem>
              {recording.canDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem destructive icon={<Trash2 />} onSelect={() => onDelete(recording)}>
                    Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <RecordingTypeBadge type={recording.recordingType} />
          {recording.project && (
            <span className="inline-flex max-w-full items-center gap-1 truncate rounded-full border border-line-bright bg-panel-2 px-2 py-0.5 text-xs text-ink-dim" title={recording.project.name}>
              <FolderKanban className="size-3 shrink-0" aria-hidden="true" />
              <span className="truncate">{recording.project.name}</span>
            </span>
          )}
        </div>

        <div className={cn("mt-auto flex items-center gap-2 border-t border-line/70 pt-3 text-xs text-ink-mute")}>
          <Avatar user={recording.owner} size="xs" />
          <span className="min-w-0 flex-1 truncate">{mine ? "You" : fullName(recording.owner)}</span>
          <time dateTime={recording.createdAt} title={new Date(recording.createdAt).toLocaleString()} className="shrink-0">
            {timeAgo(recording.createdAt)}
          </time>
        </div>
      </div>
    </article>
  );
}
