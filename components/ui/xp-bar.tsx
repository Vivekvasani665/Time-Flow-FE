import { cn } from "@/lib/utils";

type XpBarProps = {
  value: number; // 0..100
  /** @deprecated The bar is continuous now; accepted so existing callers compile. */
  segments?: number;
  label?: string;
  showValue?: boolean;
  tone?: "cyan" | "lime" | "violet";
  className?: string;
};

const FILL = { cyan: "bg-cyan", lime: "bg-lime", violet: "bg-violet" };

/** Progress bar. The name predates the redesign. */
export function XpBar({ value, label, showValue = true, tone, className }: XpBarProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const resolvedTone = tone ?? (clamped === 100 ? "lime" : "cyan");
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-panel-3"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={clamped}
        aria-label={label ?? "Progress"}
      >
        <div className={cn("h-full rounded-full transition-[width] duration-500", FILL[resolvedTone])} style={{ width: `${clamped}%` }} />
      </div>
      {showValue && <span className="tabular w-10 text-right text-xs text-ink-mute">{clamped}%</span>}
    </div>
  );
}
