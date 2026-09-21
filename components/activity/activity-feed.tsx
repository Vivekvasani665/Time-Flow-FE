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

/** Compact timeline used on the dashboard: who, what, and when. */
export function ActivityFeed({ items, describeAction }: { items: ActivityLog[]; describeAction?: (action: string) => string }) {
  return (
    <ol className="space-y-4">
      {items.map((log) => (
        <li key={log.id} className="flex items-start gap-3">
          {log.user ? <Avatar user={log.user} size="sm" /> : <EntityIcon entity={log.entity} />}
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-sm leading-snug text-ink">{log.description}</p>
            <p className="mt-0.5 truncate text-xs text-ink-mute">{describeAction ? describeAction(log.action) : log.action}</p>
          </div>
          <span className="tabular shrink-0 text-xs whitespace-nowrap text-ink-mute" title={formatDateTime(log.createdAt)}>
            {timeAgo(log.createdAt)}
          </span>
        </li>
      ))}
    </ol>
  );
}
