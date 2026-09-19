"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";
import { Logo } from "@/components/layout/logo";
import { queryKeys } from "@/lib/query-keys";
import { fullName } from "@/lib/utils";
import { authService } from "@/services/auth.service";
import type { AuthUser } from "@/types/api";
import { LoginForm } from "./login-form";

function safeNext(next: string | null) {
  // Only allow same-origin relative paths (prevents open redirects).
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

export function LoginScreen({ hasSession = true }: { hasSession?: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const queryClient = useQueryClient();
  const next = safeNext(params.get("next"));

  // Already signed in (or refreshable)? Skip the login screen.
  useEffect(() => {
    if (!hasSession) return;
    let cancelled = false;
    authService
      .me()
      .then((user) => {
        if (cancelled) return;
        queryClient.setQueryData(queryKeys.me, user);
        router.replace(next);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [hasSession, next, queryClient, router]);

  const handleSuccess = (user: AuthUser) => {
    queryClient.setQueryData(queryKeys.me, user);
    toast.success("Signed in", { description: `Welcome back, ${fullName(user)}.` });
    router.replace(next);
    router.refresh();
  };

  return (
    <div className="grid min-h-dvh bg-void lg:grid-cols-[1fr_1.1fr]">
      {/* Brand panel */}
      <section className="relative hidden flex-col justify-between overflow-hidden bg-[#111827] p-12 text-white lg:flex">
        <div className="[&_span]:!text-white">
          <Logo />
        </div>
        <div className="max-w-md space-y-5">
          <h2 className="text-4xl leading-tight font-semibold tracking-tight">Plan projects, assign work and keep your team in sync.</h2>
          <p className="text-lg text-white/65">
            One workspace for projects, tasks, people and permissions — with an audit trail for every change.
          </p>
          <ul className="space-y-2.5 pt-2 text-sm text-white/80">
            {["Role-based access control", "Task and project tracking", "Email notifications with replies in the app"].map((item) => (
              <li key={item} className="flex items-center gap-2.5">
                <CheckCircle2 className="size-4 text-[#a5b4fc]" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-sm text-white/45">© {new Date().getFullYear()} TimeFlow</p>
      </section>

      {/* Sign-in form */}
      <section className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Sign in</h1>
          <p className="mt-1 mb-7 text-sm text-ink-dim">Welcome back. Enter your details to continue.</p>
          <LoginForm onSuccess={handleSuccess} />
        </div>
      </section>
    </div>
  );
}
