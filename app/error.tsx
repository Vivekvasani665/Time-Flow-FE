"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/states";
import { logDiagnostic } from "@/lib/api/errors";

/** Catches crashes outside the app shell — the login, sign-up, reset and invitation pages. */
export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => logDiagnostic("warn", "page render failed", { error, digest: error.digest }), [error]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-void px-4">
      <ErrorState title="Something Went Wrong" message="We couldn’t load this page. Please try again." onRetry={reset} />
    </div>
  );
}
