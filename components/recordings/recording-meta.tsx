import { AppWindow, Globe, Monitor, MonitorPlay, Webcam, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import type { Tone } from "@/lib/labels";
import { RECORDING_MODES } from "@/lib/recording/media-support";
import { cn } from "@/lib/utils";
import type { RecordingType } from "@/types/recording";

export const RECORDING_TYPE_ICON: Record<RecordingType, LucideIcon> = {
  FULL_SCREEN: Monitor,
  WINDOW: AppWindow,
  BROWSER_TAB: Globe,
  SCREEN_WEBCAM: MonitorPlay,
  WEBCAM: Webcam,
};

const TONE: Record<RecordingType, Tone> = {
  FULL_SCREEN: "blue",
  WINDOW: "violet",
  BROWSER_TAB: "cyan",
  SCREEN_WEBCAM: "magenta",
  WEBCAM: "lime",
};

export function RecordingTypeBadge({ type, className }: { type: RecordingType; className?: string }) {
  const Icon = RECORDING_TYPE_ICON[type];
  return (
    <Badge tone={TONE[type]} className={className}>
      <Icon className="size-3" aria-hidden="true" />
      {RECORDING_MODES[type].label}
    </Badge>
  );
}

/** 75 → "1:15", 3725 → "1:02:05". */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return "—";
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

type SwitchRowProps = {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  icon?: LucideIcon;
};

/** A labelled on/off switch (role="switch"), for the recorder's audio and camera options. */
export function SwitchRow({ id, label, description, checked, onCheckedChange, disabled, icon: Icon }: SwitchRowProps) {
  return (
    <div className={cn("flex items-center gap-3", disabled && "opacity-55")}>
      {Icon && (
        <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", checked && !disabled ? "bg-cyan/10 text-cyan" : "bg-panel-3 text-ink-mute")}>
          <Icon className="size-4" aria-hidden="true" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <label htmlFor={id} className="block text-sm font-medium text-ink">
          {label}
        </label>
        {description && <p className="text-xs text-ink-mute">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors disabled:cursor-not-allowed",
          checked ? "bg-cyan" : "bg-line-bright",
        )}
      >
        <span className={cn("inline-block size-4 rounded-full bg-white shadow transition-transform", checked ? "translate-x-[1.125rem]" : "translate-x-0.5")} />
      </button>
    </div>
  );
}

/**
 * Copies the recording's in-app link. Opening it still requires access: the
 * owner, members of its project, or a recordings administrator.
 */
export async function copyRecordingLink(id: string) {
  const url = `${window.location.origin}/recordings/${id}`;
  try {
    await navigator.clipboard.writeText(url);
    toast.success("Link copied", { description: "Anyone who can see this recording can open it." });
  } catch {
    toast.error("Couldn't copy the link", { description: url });
  }
}
