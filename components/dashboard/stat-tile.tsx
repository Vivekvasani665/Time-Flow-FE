import type { LucideIcon } from "lucide-react";
import { CountUp } from "@/components/ui/count-up";
import type { Tone } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { TONE } from "@/components/ui/tone";

type StatTileProps = {
  label: string;
  value: number | null;
  icon: LucideIcon;
  tone: Tone;
  caption?: string;
  ratio?: number; // 0..100 progress bar
};

/** KPI card: neutral number, tone only on the icon and the progress fill. */
export function StatTile({ label, value, icon: Icon, tone, caption, ratio }: StatTileProps) {
  const t = TONE[tone];
  return (
    <div className="hud-panel clip-corner p-5 transition-colors hover:border-line-bright">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-ink-mute">{label}</p>
        <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", t.bg, t.text)}>
          <Icon className="size-4" />
        </span>
      </div>
      <p className="tabular mt-2 text-3xl font-semibold tracking-tight text-ink">
        {value === null ? <span className="text-ink-mute">—</span> : <CountUp value={value} />}
      </p>
      <div className="mt-3 flex items-center gap-3">
        {ratio !== undefined && (
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-panel-3">
            <div className={cn("h-full rounded-full transition-[width] duration-700", t.dot)} style={{ width: `${Math.min(100, ratio)}%` }} />
          </div>
        )}
        {caption && <span className="text-xs whitespace-nowrap text-ink-mute">{caption}</span>}
      </div>
    </div>
  );
}
