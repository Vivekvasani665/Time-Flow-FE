import { Shield, ShieldCheck, ShieldHalf, User, UserCog } from "lucide-react";
import type { ReactNode } from "react";
import { PASSWORD_RESET_STATUS, PRIORITY, PROJECT_STATUS, TASK_STATUS, USER_STATUS, roleRank, type Rank, type Tone } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { PasswordResetStatus, Priority, ProjectStatus, TaskStatus, UserStatus } from "@/types/api";
import { TONE } from "./tone";

export function Badge({ tone = "cyan", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  const t = TONE[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        t.text,
        t.border,
        t.bg,
        className,
      )}
    >
      {children}
    </span>
  );
}

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  const meta = PROJECT_STATUS[status];
  return (
    <Badge tone={meta.tone}>
      <span className={cn("size-1.5 rounded-full", TONE[meta.tone].dot)} aria-hidden="true" />
      {meta.label}
    </Badge>
  );
}

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const meta = TASK_STATUS[status];
  return (
    <Badge tone={meta.tone}>
      <span className={cn("size-1.5 rounded-full", TONE[meta.tone].dot)} aria-hidden="true" />
      {meta.label}
    </Badge>
  );
}

export function PasswordResetStatusBadge({ status }: { status: PasswordResetStatus }) {
  const meta = PASSWORD_RESET_STATUS[status];
  return (
    <Badge tone={meta.tone}>
      <span className={cn("size-1.5 rounded-full", TONE[meta.tone].dot)} aria-hidden="true" />
      {meta.label}
    </Badge>
  );
}

export function UserStatusBadge({ status }: { status: UserStatus }) {
  const meta = USER_STATUS[status];
  return (
    <span className={cn("inline-flex items-center gap-2 text-sm font-medium", TONE[meta.tone].text)}>
      <span className={cn("size-2 rounded-full", TONE[meta.tone].dot, status === "ACTIVE" && "")} aria-hidden="true" />
      {status === "ACTIVE" ? "Active" : "Inactive"}
    </span>
  );
}

/** Priority as ascending bars. */
export function PriorityIndicator({ priority, showLabel = true }: { priority: Priority; showLabel?: boolean }) {
  const meta = PRIORITY[priority];
  const t = TONE[meta.tone];
  return (
    <span className={cn("inline-flex items-center gap-2 text-sm font-medium", t.text)} title={`${meta.label} priority`}>
      <span className="flex items-end gap-[3px]" aria-hidden="true">
        {[1, 2, 3, 4].map((bar) => (
          <span
            key={bar}
            className={cn("w-[3px] rounded-full", bar <= meta.level ? t.dot : "bg-line-bright")}
            style={{ height: `${4 + bar * 3}px` }}
          />
        ))}
      </span>
      {showLabel ? meta.label : <span className="sr-only">{meta.label} priority</span>}
    </span>
  );
}

/** Role access level, from most to least privileged. */
const RANK_STYLE: Record<Rank, { label: string; className: string; icon: ReactNode }> = {
  diamond: { label: "Full access", className: "text-violet border-violet/30 bg-violet/10", icon: <ShieldCheck className="size-3" /> },
  gold: { label: "Administrator", className: "text-cyan border-cyan/30 bg-cyan/10", icon: <Shield className="size-3" /> },
  silver: { label: "Manager", className: "text-blue border-blue/30 bg-blue/10", icon: <ShieldHalf className="size-3" /> },
  bronze: { label: "Member", className: "text-ink-dim border-line-bright bg-panel-3", icon: <User className="size-3" /> },
  iron: { label: "Custom role", className: "text-ink-dim border-line-bright bg-panel-3", icon: <UserCog className="size-3" /> },
};

export function RankBadge({ roleName, className }: { roleName: string; className?: string }) {
  const rank = RANK_STYLE[roleRank(roleName)];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        rank.className,
        className,
      )}
      title={rank.label}
    >
      {rank.icon}
      {roleName}
    </span>
  );
}
