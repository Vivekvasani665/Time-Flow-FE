"use client";

import { AlertTriangle, Clock, HardDrive, Save, Trash2, X } from "lucide-react";
import { useState, type KeyboardEvent } from "react";
import { usePermissions } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { useProjects } from "@/hooks/use-projects";
import type { RecordingResult } from "@/hooks/use-screen-recorder";
import { formatBytes } from "@/lib/recording/media-support";
import type { RecorderState } from "@/lib/recording/recording-state";
import type { CompleteUploadInput } from "@/types/recording";
import { formatDuration, RecordingTypeBadge } from "./recording-meta";
import { RecordingPlayer } from "./recording-player";

export type RecordingDetails = Omit<CompleteUploadInput, "recordingId">;

type Props = {
  status: RecorderState;
  result: RecordingResult | null;
  error: string | null;
  progress: number;
  onSave: (details: RecordingDetails) => void;
  onDiscard: () => void;
  onCancelUpload: () => void;
};

const MAX_TAGS = 10;

function defaultTitle() {
  const when = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date());
  return `Recording – ${when}`;
}

function TagInput({ tags, onChange, disabled }: { tags: string[]; onChange: (tags: string[]) => void; disabled?: boolean }) {
  const [draft, setDraft] = useState("");
  const add = (raw: string) => {
    const incoming = raw
      .split(",")
      .map((t) => t.trim().slice(0, 40))
      .filter(Boolean);
    const next = [...tags];
    for (const t of incoming) if (next.length < MAX_TAGS && !next.some((x) => x.toLowerCase() === t.toLowerCase())) next.push(t);
    onChange(next);
    setDraft("");
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === "Enter" || e.key === ",") && draft.trim()) {
      e.preventDefault();
      add(draft);
    } else if (e.key === "Backspace" && !draft && tags.length) {
      onChange(tags.slice(0, -1));
    }
  };
  return (
    <div className="field-input flex min-h-9 flex-wrap items-center gap-1.5 py-1.5">
      {tags.map((tag) => (
        <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-cyan/10 py-0.5 pr-1 pl-2 text-xs font-medium text-cyan">
          {tag}
          <button type="button" disabled={disabled} onClick={() => onChange(tags.filter((t) => t !== tag))} className="cursor-pointer rounded-full p-0.5 hover:bg-cyan/15" aria-label={`Remove tag ${tag}`}>
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        id="recording-tags"
        value={draft}
        disabled={disabled || tags.length >= MAX_TAGS}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => draft.trim() && add(draft)}
        placeholder={tags.length ? "" : "e.g. demo, onboarding"}
        className="min-w-24 flex-1 bg-transparent text-sm outline-none placeholder:text-ink-mute"
      />
    </div>
  );
}

/**
 * Review step after stopping. The recording exists only in this browser
 * (an object URL) until "Save Recording" uploads it.
 */
export function RecordingPreview({ status, result, error, progress, onSave, onDiscard, onCancelUpload }: Props) {
  const { can } = usePermissions();
  const projects = useProjects({ limit: 100, sortBy: "name", sortOrder: "asc" }, can("projects.view"));
  const [title, setTitle] = useState(defaultTitle);
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState<string | undefined>();
  const [tags, setTags] = useState<string[]>([]);
  const [titleError, setTitleError] = useState<string | undefined>();
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const uploading = status === "UPLOADING";
  const saved = status === "SAVED";
  const processing = status === "PROCESSING" || !result;
  const busy = uploading || saved || processing;

  const save = () => {
    const trimmed = title.trim();
    if (!trimmed) return setTitleError("Give the recording a title");
    if (trimmed.length > 160) return setTitleError("Title must be at most 160 characters");
    setTitleError(undefined);
    if (!result) return;
    onSave({
      title: trimmed,
      description: description.trim() || null,
      projectId: projectId ?? null,
      tags,
      duration: result.durationSeconds,
      recordingType: result.recordingType,
    });
  };

  return (
    <>
      <Dialog
        open
        onOpenChange={(open) => {
          if (open) return;
          if (uploading) return;
          setConfirmDiscard(true);
        }}
        title={saved ? "Recording saved" : "Review your recording"}
        description={processing ? "Preparing your recording…" : "Only you can see this until you save it."}
        className="max-h-[calc(100dvh-2rem)] max-w-5xl overflow-y-auto"
        footer={
          processing ? undefined : (
            <>
              <Button variant="ghost" icon={<Trash2 className="size-4" />} onClick={() => setConfirmDiscard(true)} disabled={busy} className="sm:mr-auto">
                Discard
              </Button>
              {uploading ? (
                <Button variant="secondary" onClick={onCancelUpload}>
                  Cancel upload
                </Button>
              ) : null}
              <Button onClick={save} loading={uploading || saved} disabled={busy} icon={<Save className="size-4" />}>
                {status === "UPLOAD_FAILED" ? "Try again" : "Save Recording"}
              </Button>
            </>
          )
        }
      >
        {processing ? (
          <div className="flex aspect-video items-center justify-center rounded-xl bg-panel-2">
            <Spinner className="size-8 text-cyan" />
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <div className="space-y-3">
              <RecordingPlayer src={result.url} />
              <dl className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink-dim">
                <div className="flex items-center gap-1.5">
                  <dt className="sr-only">Type</dt>
                  <dd>
                    <RecordingTypeBadge type={result.recordingType} />
                  </dd>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="size-4 text-ink-mute" aria-hidden="true" />
                  <dt className="sr-only">Duration</dt>
                  <dd className="tabular">{formatDuration(result.durationSeconds)}</dd>
                </div>
                <div className="flex items-center gap-1.5">
                  <HardDrive className="size-4 text-ink-mute" aria-hidden="true" />
                  <dt className="sr-only">File size</dt>
                  <dd className="tabular">{formatBytes(result.size)}</dd>
                </div>
                <div className="text-xs text-ink-mute uppercase">{result.mimeType.replace("video/", "")}</div>
              </dl>
            </div>

            <div className="space-y-4">
              <Field label="Title" htmlFor="recording-title" error={titleError} required>
                <Input id="recording-title" value={title} maxLength={160} disabled={busy} onChange={(e) => setTitle(e.target.value)} aria-invalid={titleError ? true : undefined} />
              </Field>
              <Field label="Description" htmlFor="recording-description">
                <Textarea id="recording-description" value={description} maxLength={2000} disabled={busy} onChange={(e) => setDescription(e.target.value)} placeholder="What's this recording about?" />
              </Field>
              {can("projects.view") && (
                <Field label="Project" htmlFor="recording-project" hint="Members of the project will be able to watch it.">
                  <Select
                    id="recording-project"
                    value={projectId}
                    onValueChange={setProjectId}
                    allLabel="No project (only me)"
                    disabled={busy || projects.isLoading}
                    options={(projects.data?.items ?? []).map((p) => ({ value: p.id, label: p.name }))}
                  />
                </Field>
              )}
              <Field label="Tags" htmlFor="recording-tags" hint={`Press Enter or comma to add. Up to ${MAX_TAGS}.`}>
                <TagInput tags={tags} onChange={setTags} disabled={busy} />
              </Field>

              {(uploading || saved) && (
                <div className="space-y-1.5" aria-live="polite">
                  <div className="flex justify-between text-xs text-ink-dim">
                    <span>{saved ? "Saved" : progress >= 1 ? "Finishing up…" : "Uploading…"}</span>
                    <span className="tabular">{Math.round(progress * 100)}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-panel-3" role="progressbar" aria-label="Upload progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
                    <div className="h-full rounded-full bg-cyan transition-[width] duration-200" style={{ width: `${Math.round(progress * 100)}%` }} />
                  </div>
                </div>
              )}
              {status === "UPLOAD_FAILED" && error && (
                <div role="alert" className="flex items-start gap-2.5 rounded-lg border border-danger/30 bg-danger/10 px-3.5 py-3 text-sm text-ink">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
                  <p>
                    {error} Your recording is still here — nothing was lost.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </Dialog>
      <ConfirmDialog
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        title="Discard this recording?"
        description="It hasn't been saved, so it will be gone for good."
        confirmLabel="Discard"
        onConfirm={() => {
          setConfirmDiscard(false);
          onDiscard();
        }}
      />
    </>
  );
}
