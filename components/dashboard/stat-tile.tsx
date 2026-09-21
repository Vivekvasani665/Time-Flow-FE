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
  /** Small decorative glyph in the bottom-right corner. */
  accent?: LucideIcon;
};

/** KPI card: tinted icon, neutral number, short factual caption. */
export function StatTile({ label, value, icon: Icon, tone, caption, accent: Accent }: StatTileProps) {
  const t = TONE[tone];
  return (
    <div className="hud-panel relative flex gap-3.5 rounded-2xl p-5 transition-colors hover:border-line-bright">
      <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl", t.bg, t.text)} aria-hidden="true">
        <Icon className="size-6" />
      </span>
      <div className={cn("min-w-0", Accent && "pr-6")}>
        <p className="text-sm font-medium text-ink-dim">{label}</p>
        <p className="tabular mt-1 text-3xl font-bold tracking-tight text-ink">
          {value === null ? <span className="text-ink-mute">—</span> : <CountUp value={value} />}
        </p>
        {caption && <p className="mt-2 text-xs text-ink-mute">{caption}</p>}
      </div>
      {Accent && <Accent className={cn("absolute right-5 bottom-5 size-5", t.text)} aria-hidden="true" />}
    </div>
  );
}
