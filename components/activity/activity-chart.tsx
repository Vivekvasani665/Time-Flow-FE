"use client";

import { BarChart3 } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { useActivityStats } from "@/hooks/use-activity";
import { ENTITY_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { ActivityListParams, ActivityStats } from "@/types/api";

const CHART_HEIGHT = 176;

/** Days arrive as UTC calendar dates; format them in UTC so they never shift a day. */
const formatDay = (date: string, withYear = false) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, { month: "short", day: "numeric", ...(withYear ? { year: "numeric" } : {}), timeZone: "UTC" });

const plural = (n: number) => `${n.toLocaleString()} ${n === 1 ? "event" : "events"}`;

/** Rounds the axis top up to 1 / 2 / 5 × 10ⁿ so ticks land on clean numbers. */
function niceTicks(max: number): number[] {
  if (max <= 0) return [0, 1];
  const rough = max / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 5, 10].map((m) => m * magnitude).find((s) => s >= rough) ?? 10 * magnitude;
  const ticks: number[] = [];
  for (let t = 0; t < max + step; t += Math.max(1, step)) ticks.push(t);
  return ticks;
}

export function ActivityChart({ params, onSelectDay }: { params: ActivityListParams; onSelectDay: (date: string) => void }) {
  const query = useActivityStats(params);
  const stats = query.data;

  return (
    <div className="grid border-b border-line xl:grid-cols-[2fr_1fr]">
      <ChartSection
        title="Activity over time"
        icon={<BarChart3 />}
        subtitle={stats ? `${plural(stats.total)} · ${formatDay(stats.from, true)} – ${formatDay(stats.to, true)} (UTC)` : undefined}
      >
        {query.isLoading ? (
          <Skeleton className="h-52" />
        ) : query.error && !stats ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} className="py-6" />
        ) : stats ? (
          <DailyColumns stats={stats} fetching={query.isFetching} onSelectDay={onSelectDay} />
        ) : null}
      </ChartSection>

      <ChartSection title="By entity" subtitle="Same filters and date range" className="border-t border-line xl:border-t-0 xl:border-l">
        {query.isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-7" />
            ))}
          </div>
        ) : stats && stats.byEntity.length > 0 ? (
          <EntityBars data={stats.byEntity} />
        ) : stats ? (
          <p className="py-6 text-center text-sm text-ink-mute">No activity in this range.</p>
        ) : null}
      </ChartSection>
    </div>
  );
}

/** A titled region inside the activity log panel (no panel chrome of its own). */
function ChartSection({ title, subtitle, icon, className, children }: { title: string; subtitle?: string; icon?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <section className={cn("min-w-0 p-4 sm:p-5", className)}>
      <header className="mb-4 flex min-w-0 items-center gap-2.5">
        {icon && <span className="text-ink-mute [&>svg]:size-4">{icon}</span>}
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-ink">{title}</h2>
          {subtitle && <p className="truncate text-xs text-ink-mute">{subtitle}</p>}
        </div>
      </header>
      {children}
    </section>
  );
}

function DailyColumns({ stats, fetching, onSelectDay }: { stats: ActivityStats; fetching: boolean; onSelectDay: (date: string) => void }) {
  const [active, setActive] = useState<number | null>(null);
  const { days } = stats;
  const ticks = niceTicks(Math.max(...days.map((d) => d.count)));
  const top = ticks[ticks.length - 1]!;
  const dense = days.length > 90;
  const hovered = active === null ? null : days[active];
  const labelIndexes = [...new Set([0, Math.floor((days.length - 1) / 2), days.length - 1])];

  return (
    <div className={cn("transition-opacity", fetching && "opacity-70")}>
      <div className="flex gap-2">
        {/* Y axis */}
        <div className="relative w-8 shrink-0" style={{ height: CHART_HEIGHT }} aria-hidden="true">
          {ticks.map((t) => (
            <span key={t} className="tabular absolute right-0 -translate-y-1/2 text-[0.65rem] text-ink-mute" style={{ bottom: `${(t / top) * 100}%` }}>
              {t.toLocaleString()}
            </span>
          ))}
        </div>

        <div className="relative min-w-0 flex-1" style={{ height: CHART_HEIGHT }} onMouseLeave={() => setActive(null)}>
          {/* Gridlines */}
          {ticks.map((t) => (
            <div key={t} className="pointer-events-none absolute inset-x-0 border-t border-line" style={{ bottom: `${(t / top) * 100}%` }} aria-hidden="true" />
          ))}

          {/* Columns — each full-height slot is the hover / click target, larger than the bar it holds. */}
          <div className={cn("absolute inset-0 flex items-end", !dense && "gap-[2px]")}>
            {days.map((d, i) => (
              <button
                key={d.date}
                type="button"
                aria-label={`${formatDay(d.date, true)}: ${plural(d.count)}. Show only this day.`}
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                onClick={() => onSelectDay(d.date)}
                className="group flex h-full min-w-0 flex-1 items-end justify-center outline-none"
              >
                <span
                  className={cn(
                    "block w-full max-w-6 rounded-t-[4px] bg-cyan transition-opacity",
                    active !== null && active !== i && "opacity-40",
                    "group-focus-visible:ring-2 group-focus-visible:ring-cyan group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-panel",
                  )}
                  style={{ height: d.count === 0 ? 0 : `max(2px, ${(d.count / top) * 100}%)` }}
                />
              </button>
            ))}
          </div>

          {/* Tooltip */}
          {hovered && active !== null && (
            <div
              role="status"
              className={cn(
                "pointer-events-none absolute top-0 z-10 rounded-md border border-line bg-panel px-2.5 py-1.5 text-xs whitespace-nowrap shadow-lg",
                active < days.length * 0.2 ? "" : active > days.length * 0.8 ? "-translate-x-full" : "-translate-x-1/2",
              )}
              style={{ left: `${((active + 0.5) / days.length) * 100}%` }}
            >
              <p className="text-ink-mute">{formatDay(hovered.date, true)}</p>
              <p className="tabular font-semibold text-ink">{plural(hovered.count)}</p>
            </div>
          )}
        </div>
      </div>

      {/* X axis: first, middle and last day */}
      <div className="relative mt-2 ml-10 h-4 text-[0.65rem] text-ink-mute" aria-hidden="true">
        {labelIndexes.map((i, n) => (
          <span
            key={i}
            className={cn("tabular absolute whitespace-nowrap", n === 0 ? "left-0" : n === labelIndexes.length - 1 ? "right-0" : "-translate-x-1/2")}
            style={n > 0 && n < labelIndexes.length - 1 ? { left: `${((i + 0.5) / days.length) * 100}%` } : undefined}
          >
            {formatDay(days[i]!.date)}
          </span>
        ))}
      </div>

      <p className="mt-3 text-xs text-ink-mute">Click a day to show only its activity.</p>

      <table className="sr-only">
        <caption>Activity per day</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">Events</th>
          </tr>
        </thead>
        <tbody>
          {days.map((d) => (
            <tr key={d.date}>
              <td>{formatDay(d.date, true)}</td>
              <td>{d.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** One bar per entity, single hue — the length carries the count, the label carries identity. */
function EntityBars({ data }: { data: ActivityStats["byEntity"] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <ul className="space-y-4">
      {data.map((d) => (
        <li key={d.entity}>
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <span className="truncate text-sm text-ink-dim">{ENTITY_LABELS[d.entity] ?? d.entity.replace(/_/g, " ")}</span>
            <span className="tabular text-sm font-medium text-ink">{d.count.toLocaleString()}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-panel-3" aria-hidden="true">
            <div className="h-full rounded-full bg-cyan transition-[width] duration-500" style={{ width: `${(d.count / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
