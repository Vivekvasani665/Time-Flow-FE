import type { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  kicker?: string;
  description?: ReactNode;
  actions?: ReactNode;
};

export function PageHeader({ title, kicker, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 space-y-1">
        {kicker && <p className="eyebrow">{kicker}</p>}
        <h1 className="truncate text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {description && <div className="text-sm text-ink-dim">{description}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
