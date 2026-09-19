import { PROJECT_STATUS, TASK_STATUS, type Tone } from "@/lib/labels";
import { cn, percent } from "@/lib/utils";
import type { ProjectStatus, TaskStatus } from "@/types/api";
import { TONE } from "@/components/ui/tone";

const TONE_HEX: Record<Tone, string> = {
  cyan: "var(--color-cyan)",
  violet: "var(--color-violet)",
  magenta: "var(--color-magenta)",
  lime: "var(--color-lime)",
  amber: "var(--color-amber)",
  red: "var(--color-danger)",
  blue: "var(--color-blue)",
  gray: "var(--color-ink-mute)",
};

/** Donut of tasks per status, with the completion rate in the centre. */
export function TaskStatusDonut({ data }: { data: { status: TaskStatus; count: number }[] }) {
  const total = data.reduce((sum, d) => sum + d.count, 0);
  const completed = data.find((d) => d.status === "COMPLETED")?.count ?? 0;
  const radius = 64;
  const circumference = 2 * Math.PI * radius;
  const gap = total > 0 && data.filter((d) => d.count > 0).length > 1 ? 2 : 0;
  let offset = 0;

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row">
      <div className="relative size-40 shrink-0">
        <svg viewBox="0 0 160 160" className="size-full -rotate-90" role="img" aria-label={`Tasks by status: ${data.map((d) => `${TASK_STATUS[d.status].label} ${d.count}`).join(", ")}`}>
          <circle cx="80" cy="80" r={radius} fill="none" stroke="var(--color-panel-3)" strokeWidth="12" />
          {total > 0 &&
            data.map((d) => {
              if (d.count === 0) return null;
              const length = (d.count / total) * circumference;
              const el = (
                <circle
                  key={d.status}
                  cx="80"
                  cy="80"
                  r={radius}
                  fill="none"
                  stroke={TONE_HEX[TASK_STATUS[d.status].tone]}
                  strokeWidth="12"
                  strokeDasharray={`${Math.max(0, length - gap)} ${circumference}`}
                  strokeDashoffset={-offset}
                />
              );
              offset += length;
              return el;
            })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="tabular text-2xl font-semibold tracking-tight text-ink">{percent(completed, total)}%</span>
          <span className="text-xs text-ink-mute">Completed</span>
        </div>
      </div>
      <ul className="grid w-full grid-cols-2 gap-2.5 sm:grid-cols-1">
        {data.map((d) => {
          const meta = TASK_STATUS[d.status];
          return (
            <li key={d.status} className="flex items-center gap-2.5">
              <span className={cn("size-2 shrink-0 rounded-full", TONE[meta.tone].dot)} aria-hidden="true" />
              <span className="flex-1 truncate text-sm text-ink-dim">{meta.label}</span>
              <span className="tabular text-sm font-medium text-ink">{d.count}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** One continuous bar per project status, scaled to the largest count. */
export function ProjectStatusBars({ data }: { data: { status: ProjectStatus; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <ul className="space-y-4">
      {data.map((d) => {
        const meta = PROJECT_STATUS[d.status];
        return (
          <li key={d.status}>
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-sm text-ink-dim">
                <span className={cn("size-2 rounded-full", TONE[meta.tone].dot)} aria-hidden="true" />
                {meta.label}
              </span>
              <span className="tabular text-sm font-medium text-ink">{d.count}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-panel-3" aria-hidden="true">
              <div className={cn("h-full rounded-full transition-[width] duration-500", TONE[meta.tone].dot)} style={{ width: `${(d.count / max) * 100}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
