import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type PanelProps = {
  title?: string;
  subtitle?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  /** @deprecated No longer drawn; accepted so existing callers compile. */
  brackets?: boolean;
};

export function Panel({ title, subtitle, icon, actions, children, className, bodyClassName }: PanelProps) {
  return (
    <section className={cn("hud-panel clip-corner", className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            {icon && <span className="text-ink-mute [&>svg]:size-4">{icon}</span>}
            <div className="min-w-0">
              {title && <h2 className="truncate text-sm font-semibold text-ink">{title}</h2>}
              {subtitle && <p className="truncate text-xs text-ink-mute">{subtitle}</p>}
            </div>
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn("p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

export function DataRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-b border-line/60 py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <dt className="text-sm text-ink-mute">{label}</dt>
      <dd className="text-sm font-medium text-ink sm:text-right">{children}</dd>
    </div>
  );
}
