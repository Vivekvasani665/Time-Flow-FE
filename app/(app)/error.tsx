"use client";

import { ErrorState } from "@/components/ui/states";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="hud-panel clip-corner mt-10">
      <ErrorState title="Something went wrong" message={error.message || "An unexpected error occurred. Please try again."} onRetry={reset} />
    </div>
  );
}
