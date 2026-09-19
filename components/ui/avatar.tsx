import { cn, initials } from "@/lib/utils";

type AvatarProps = {
  user: { firstName: string; lastName: string; avatarUrl: string | null } | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  /** Adds a thin outline to separate the avatar from its background. */
  ring?: boolean;
  className?: string;
};

const SIZES = {
  xs: "size-6 text-[0.625rem]",
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-14 text-base",
  xl: "size-24 text-2xl",
};

export function Avatar({ user, size = "sm", ring, className }: AvatarProps) {
  const label = user ? `${user.firstName} ${user.lastName}` : "Unassigned";
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-panel-3 font-medium text-ink-dim",
        ring && "ring-2 ring-panel",
        SIZES[size],
        className,
      )}
      title={label}
    >
      {user?.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- user uploads are served by the API proxy
        <img src={user.avatarUrl} alt={label} className="size-full object-cover" />
      ) : (
        <span aria-label={label}>{initials(user)}</span>
      )}
    </span>
  );
}

export function AvatarStack({ users, max = 4 }: { users: AvatarProps["user"][]; max?: number }) {
  const visible = users.slice(0, max);
  const extra = users.length - visible.length;
  return (
    <div className="flex items-center -space-x-1">
      {visible.map((u, i) => (
        <Avatar key={i} user={u} size="xs" ring className="size-7" />
      ))}
      {extra > 0 && (
        <span className="z-10 flex size-7 items-center justify-center rounded-full bg-panel-3 text-[0.625rem] font-medium text-ink-dim ring-2 ring-panel">
          +{extra}
        </span>
      )}
    </div>
  );
}
