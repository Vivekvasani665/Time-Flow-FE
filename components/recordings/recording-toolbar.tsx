"use client";

import { Mic, MicOff, Pause, Play, Square, Trash2, Video, VideoOff } from "lucide-react";
import type { ReactNode } from "react";
import { formatTimer } from "@/lib/call-state";
import { cn } from "@/lib/utils";

type Props = {
  paused: boolean;
  elapsedMs: number;
  micOn: boolean;
  hasMicrophone: boolean;
  cameraOn: boolean;
  hasCamera: boolean;
  onPause: () => void;
  onResume: () => void;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onStop: () => void;
  onDiscard: () => void;
};

function ToolButton({ label, onClick, disabled, active = true, children, className }: { label: string; onClick: () => void; disabled?: boolean; active?: boolean; children: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "flex size-9 cursor-pointer items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-35 [&>svg]:size-4",
        active ? "text-white/85 hover:bg-white/10 hover:text-white" : "bg-white/10 text-danger hover:bg-white/15",
        className,
      )}
    >
      {children}
    </button>
  );
}

/**
 * Floating controls while recording. Stays on screen on every TimeFlow page;
 * the recording continues as the user moves around the app.
 *
 *   Recording ● 00:42   [Pause] [Mic] [Camera] [Stop]
 */
export function RecordingToolbar({ paused, elapsedMs, micOn, hasMicrophone, cameraOn, hasCamera, onPause, onResume, onToggleMic, onToggleCamera, onStop, onDiscard }: Props) {
  const seconds = elapsedMs / 1000;
  return (
    <div
      role="toolbar"
      aria-label="Recording controls"
      className="fixed bottom-5 left-1/2 z-[70] flex -translate-x-1/2 items-center gap-1 rounded-full border border-white/10 bg-[#141a3a]/95 py-1.5 pr-1.5 pl-4 text-white shadow-[var(--shadow-dialog)] backdrop-blur animate-fade-up"
    >
      <div className="mr-2 flex items-center gap-2" aria-live="polite">
        <span className={cn("size-2.5 rounded-full", paused ? "bg-amber" : "bg-danger animate-pulse-glow")} aria-hidden="true" />
        <span className="text-sm font-medium">{paused ? "Paused" : "Recording"}</span>
        <time className="tabular min-w-[3.25rem] font-mono text-sm text-white/80" dateTime={`PT${Math.floor(seconds)}S`} aria-label={`Recording time ${formatTimer(seconds)}`}>
          {formatTimer(seconds)}
        </time>
      </div>
      <span className="mx-1 h-5 w-px bg-white/15" aria-hidden="true" />
      {paused ? (
        <ToolButton label="Resume" onClick={onResume}>
          <Play />
        </ToolButton>
      ) : (
        <ToolButton label="Pause" onClick={onPause}>
          <Pause />
        </ToolButton>
      )}
      <ToolButton label={!hasMicrophone ? "Microphone not in use" : micOn ? "Mute microphone" : "Unmute microphone"} onClick={onToggleMic} disabled={!hasMicrophone} active={micOn || !hasMicrophone}>
        {micOn || !hasMicrophone ? <Mic /> : <MicOff />}
      </ToolButton>
      <ToolButton label={!hasCamera ? "Camera not in use" : cameraOn ? "Turn camera off" : "Turn camera on"} onClick={onToggleCamera} disabled={!hasCamera} active={cameraOn || !hasCamera}>
        {cameraOn || !hasCamera ? <Video /> : <VideoOff />}
      </ToolButton>
      <ToolButton label="Discard recording" onClick={onDiscard}>
        <Trash2 />
      </ToolButton>
      <button
        type="button"
        onClick={onStop}
        className="ml-1 flex h-9 cursor-pointer items-center gap-2 rounded-full bg-danger px-4 text-sm font-medium text-white transition hover:opacity-90"
      >
        <Square className="size-3.5 fill-current" aria-hidden="true" />
        Stop
      </button>
    </div>
  );
}

/** 3 · 2 · 1 before the recording starts. */
export function RecordingCountdown({ value, onCancel }: { value: number; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center gap-6 bg-black/55 backdrop-blur-sm" role="alertdialog" aria-label="Recording is about to start">
      <div className="flex size-36 items-center justify-center rounded-full border-4 border-white/80 bg-black/30" aria-live="assertive">
        <span key={value} className="text-7xl font-semibold text-white tabular animate-fade-up">
          {value}
        </span>
      </div>
      <p className="text-sm text-white/80">Recording starts in {value}…</p>
      <button type="button" onClick={onCancel} className="cursor-pointer rounded-full border border-white/30 px-4 py-1.5 text-sm text-white hover:bg-white/10">
        Cancel
      </button>
    </div>
  );
}
