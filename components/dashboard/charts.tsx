"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps, type TooltipValueType } from "recharts";
import { ENTITY_LABELS, humanize } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { ActivityStats } from "@/types/api";

/** Days arrive as UTC calendar dates; format them in UTC so they never shift a day. */
const formatDay = (date: string, withYear = false) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, { month: "short", day: "numeric", ...(withYear ? { year: "numeric" } : {}), timeZone: "UTC" });

const plural = (n: number) => `${n.toLocaleString()} ${n === 1 ? "activity" : "activities"}`;

function TrendTooltip({ active, payload }: TooltipContentProps<TooltipValueType, string | number>) {
  const point = payload?.[0]?.payload as ActivityStats["days"][number] | undefined;
  if (!active || !point) return null;
  return (
    <div className="rounded-lg border border-line bg-panel px-3 py-2 text-xs shadow-[var(--shadow-overlay)]">
      <p className="font-medium text-ink">{formatDay(point.date, true)}</p>
      <p className="mt-1 flex items-center gap-1.5 text-ink-dim">
        <span className="size-2 rounded-full bg-cyan" aria-hidden="true" />
        <span className="tabular">{plural(point.count)}</span>
      </p>
    </div>
  );
}

/** Single-series area chart of activity per day, with a crosshair tooltip. */
export function ActivityTrend({ days }: { days: ActivityStats["days"] }) {
  const showDots = days.length <= 14;
  return (
    <div>
      <div className="h-56" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={days} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
            <defs>
              <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-cyan)" stopOpacity={0.18} />
                <stop offset="100%" stopColor="var(--color-cyan)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--color-line)" strokeDasharray="0" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={(d: string) => formatDay(d)}
              tick={{ fill: "var(--color-ink-mute)", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "var(--color-line)" }}
              interval="preserveStartEnd"
              minTickGap={24}
              tickMargin={8}
            />
            <YAxis allowDecimals={false} tick={{ fill: "var(--color-ink-mute)", fontSize: 11 }} tickLine={false} axisLine={false} width={48} />
            <Tooltip content={TrendTooltip} cursor={{ stroke: "var(--color-line-bright)", strokeWidth: 1 }} />
            <Area
              type="monotone"
              dataKey="count"
              stroke="var(--color-cyan)"
              strokeWidth={2}
              fill="url(#trend-fill)"
              dot={showDots ? { r: 4, fill: "var(--color-cyan)", stroke: "var(--color-panel)", strokeWidth: 2 } : false}
              activeDot={{ r: 5, fill: "var(--color-cyan)", stroke: "var(--color-panel)", strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>Activity per day</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">Activities</th>
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

/** "task.created" → "Task created"; "auth.login" → "User login". */
export function actionLabel(action: string) {
  if (action === "auth.login") return "User login";
  if (action === "auth.logout") return "User logout";
  const [entity = "", verb = ""] = action.split(".");
  const noun = ENTITY_LABELS[entity] ?? humanize(entity);
  return verb ? `${noun} ${humanize(verb).toLowerCase()}` : noun;
}

/** Bar colour follows the verb, so "created" reads the same for tasks and projects. */
function verbTone(action: string) {
  const verb = action.split(".")[1] ?? "";
  if (verb === "created") return "bg-cyan";
  if (verb === "updated") return "bg-lime";
  if (verb === "deleted") return "bg-danger";
  if (verb.startsWith("log")) return "bg-violet";
  return "bg-amber";
}

const TOP_ACTIONS = 5;

/** Top actions by count with the rest folded into "Other"; each bar is labelled, so colour is never the only cue. */
export function ActionBars({ data }: { data: ActivityStats["byAction"] }) {
  const top = data.slice(0, TOP_ACTIONS).map((d) => ({ key: d.action, label: actionLabel(d.action), count: d.count, tone: verbTone(d.action) }));
  const rest = data.slice(TOP_ACTIONS).reduce((sum, d) => sum + d.count, 0);
  const rows = rest > 0 ? [...top, { key: "other", label: "Other", count: rest, tone: "bg-ink-mute/60" }] : top;
  const max = Math.max(1, ...rows.map((r) => r.count));

  return (
    <ul className="space-y-4">
      {rows.map((r) => (
        <li key={r.key} className="grid grid-cols-[minmax(0,10rem)_1fr_2.5rem] items-center gap-3">
          <span className="truncate text-sm text-ink-dim">{r.label}</span>
          <div className="h-2 overflow-hidden rounded-full bg-panel-3" aria-hidden="true">
            <div className={cn("h-full rounded-full transition-[width] duration-500", r.tone)} style={{ width: `${(r.count / max) * 100}%` }} />
          </div>
          <span className="tabular text-right text-sm font-medium text-ink">{r.count.toLocaleString()}</span>
        </li>
      ))}
    </ul>
  );
}
