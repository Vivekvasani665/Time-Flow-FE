import { ArrowLeft } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-void px-6 text-center">
      <div className="space-y-2">
        <p className="text-sm font-semibold text-cyan">404</p>
        <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">Page not found</h1>
        <p className="max-w-md text-ink-dim">The page you&apos;re looking for doesn&apos;t exist or has been moved.</p>
      </div>
      <ButtonLink href="/dashboard" variant="secondary" icon={<ArrowLeft className="size-4" />}>
        Back to dashboard
      </ButtonLink>
    </div>
  );
}
