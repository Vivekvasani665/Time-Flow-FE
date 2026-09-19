import { AlertCircle, Inbox, RotateCcw, ShieldX } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

type EmptyStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
};

export function EmptyState({ title, description, action, icon, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-4 px-6 py-14 text-center", className)}>
      <div className="flex size-12 items-center justify-center rounded-full bg-panel-3 text-ink-mute [&>svg]:size-5">
        {icon ?? <Inbox className="size-5" />}
      </div>
      <div className="space-y-1.5">
        <p className="text-sm font-semibold text-ink">{title}</p>
        {description && <p className="max-w-sm text-sm text-ink-mute">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
  className,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div role="alert" className={cn("flex flex-col items-center justify-center gap-4 px-6 py-14 text-center", className)}>
      <div className="flex size-12 items-center justify-center rounded-full bg-danger/10 text-danger">
        <AlertCircle className="size-5" />
      </div>
      <div className="space-y-1.5">
        <p className="text-sm font-semibold text-ink">{title}</p>
        <p className="max-w-md text-sm text-ink-dim">{message ?? "We could not load this data."}</p>
      </div>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry} icon={<RotateCcw className="size-3.5" />}>
          Retry
        </Button>
      )}
    </div>
  );
}

export function AccessDenied({ permission }: { permission?: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-danger/10 text-danger">
        <ShieldX className="size-6" />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Access denied</h1>
        <p className="text-ink-dim">You don&apos;t have permission to view this page.</p>
        {permission && (
          <p className="font-mono text-xs text-ink-mute">
            Required permission: <span className="text-ink-dim">{permission}</span>
          </p>
        )}
      </div>
    </div>
  );
}
