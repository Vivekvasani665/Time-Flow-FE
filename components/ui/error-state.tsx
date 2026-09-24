"use client";

import { AlertCircle, Hourglass, LogIn, RotateCcw, SearchX, ServerCrash, ShieldX, WifiOff } from "lucide-react";
import { useState, type ReactNode } from "react";
import { describeError, type ErrorKind } from "@/lib/api/errors";
import { cn } from "@/lib/utils";
import { Button } from "./button";

const ICONS: Partial<Record<ErrorKind, ReactNode>> = {
  network: <WifiOff className="size-5" />,
  server: <ServerCrash className="size-5" />,
  auth: <LogIn className="size-5" />,
  forbidden: <ShieldX className="size-5" />,
  "not-found": <SearchX className="size-5" />,
  "rate-limit": <Hourglass className="size-5" />,
};

type ErrorStateProps = {
  /** The thrown error. Title, message, icon and whether to offer a retry all follow from its status. */
  error?: unknown;
  /** Overrides the status title with what failed ("Task unavailable"). */
  title?: string;
  /** Overrides the derived message. Must be user-facing text, never `error.message` from an unknown source. */
  message?: string;
  /** Return the refetch promise to keep the button in its loading state until it settles. */
  onRetry?: () => unknown;
  className?: string;
};

export function ErrorState({ error, title, message, onRetry, className }: ErrorStateProps) {
  const friendly = describeError(error);
  const [retrying, setRetrying] = useState(false);
  // Without an error to judge by, trust the caller; otherwise only offer what could help.
  const showRetry = !!onRetry && (error === undefined || friendly.canRetry || friendly.kind === "unknown");

  const retry = async () => {
    setRetrying(true);
    try {
      await onRetry?.();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div
      role="alert"
      aria-live="polite"
      className={cn(
        "flex flex-col items-center justify-center gap-4 px-6 py-14 text-center motion-safe:animate-fade-up",
        className,
      )}
    >
      <div className="flex size-12 items-center justify-center rounded-full bg-danger/10 text-danger">
        {ICONS[friendly.kind] ?? <AlertCircle className="size-5" />}
      </div>
      <div className="space-y-1.5">
        <p className="text-sm font-semibold text-ink">{title ?? friendly.title}</p>
        <p className="max-w-md text-sm text-ink-dim">{message ?? friendly.message}</p>
      </div>
      {showRetry && (
        <Button variant="secondary" size="sm" onClick={() => void retry()} loading={retrying} icon={<RotateCcw className="size-3.5" />}>
          {retrying ? "Trying again…" : "Try Again"}
        </Button>
      )}
    </div>
  );
}
