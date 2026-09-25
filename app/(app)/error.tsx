"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/states";
import { logDiagnostic } from "@/lib/api/errors";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  // The crash detail belongs in the console, not on the page.
  useEffect(() => logDiagnostic("warn", "page render failed", { error, digest: error.digest }), [error]);

  return (
    <div className="hud-panel clip-corner mt-10">
      <ErrorState title="Something Went Wrong" message="We couldn’t load this page. Please try again." onRetry={reset} />
    </div>
  );
}
