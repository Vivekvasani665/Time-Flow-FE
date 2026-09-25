import { toast } from "sonner";
import { describeError } from "@/lib/api/errors";

type NotifyErrorOptions = {
  /** Says what failed ("Delete failed"). Defaults to the status title ("Access Denied"). */
  title?: string;
  /** Offered as "Try Again" only when the failure is transient (5xx, timeouts, network). */
  onRetry?: () => unknown;
};

/**
 * Toast for a failed action. The message is always the friendly one — never the
 * server's raw text — and the same failure shown twice replaces itself rather
 * than stacking.
 */
export function notifyError(error: unknown, { title, onRetry }: NotifyErrorOptions = {}) {
  const friendly = describeError(error);
  const heading = title ?? friendly.title;
  return toast.error(heading, {
    id: `error:${heading}:${friendly.message}`,
    description: friendly.message,
    action: onRetry && friendly.canRetry ? { label: "Try Again", onClick: () => void onRetry() } : undefined,
  });
}
