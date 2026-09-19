"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function FormActions({ submitting, submitLabel, disabled }: { submitting: boolean; submitLabel: string; disabled?: boolean }) {
  const router = useRouter();
  return (
    <div className="flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:justify-end">
      <Button variant="secondary" onClick={() => router.back()} disabled={submitting}>
        Cancel
      </Button>
      <Button type="submit" loading={submitting} disabled={disabled}>
        {submitting ? "Saving…" : submitLabel}
      </Button>
    </div>
  );
}
