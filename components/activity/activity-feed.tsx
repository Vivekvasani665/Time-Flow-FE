import { FolderKanban, KeyRound, ListChecks, ShieldCheck, UserRound, Zap, type LucideIcon } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { cn, formatDateTime, timeAgo } from "@/lib/utils";
import type { ActivityLog } from "@/types/api";

const ENTITY_ICON: Record<string, { icon: LucideIcon; className: string }> = {
  user: { icon: UserRound, className: "text-cyan bg-cyan/10" },
  role: { icon: ShieldCheck, className: "text-amber bg-amber/10" },
  project: { icon: FolderKanban, className: "text-violet bg-violet/10" },
  task: { icon: ListChecks, className: "text-lime bg-lime/10" },
  auth: { icon: KeyRound, className: "text-magenta bg-magenta/10" },
};

export function EntityIcon({ entity }: { entity: string }) {
  const meta = ENTITY_ICON[entity] ?? { icon: Zap, className: "text-ink-dim bg-panel-3" };
  const Icon = meta.icon;
  return (
    <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", meta.className)}>
      <Icon className="size-4" />
    </span>
  );
}

/** Compact timeline used on the dashboard. */
export function ActivityFeed({ items }: { items: ActivityLog[] }) {
  return (
    <ol className="space-y-1">
      {items.map((log) => (
        <li key={log.id} className="relative flex gap-3 py-2">
          <EntityIcon entity={log.entity} />
          <div className="min-w-0 flex-1">
            <p className="text-sm leading-snug text-ink">{log.description}</p>
            <p className="mt-0.5 flex items-center gap-2 text-xs text-ink-mute">
              {log.user && <Avatar user={log.user} size="xs" className="size-4 text-[0.45rem]" />}
              <span className="tabular" title={formatDateTime(log.createdAt)}>
                {timeAgo(log.createdAt)}
              </span>
              <span className="font-mono text-[0.6875rem] text-ink-mute">{log.action}</span>
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
