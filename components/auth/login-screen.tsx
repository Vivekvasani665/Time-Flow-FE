"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";
import { Logo } from "@/components/layout/logo";
import { queryKeys } from "@/lib/query-keys";
import { cn, fullName } from "@/lib/utils";
import { authService } from "@/services/auth.service";
import type { AuthUser } from "@/types/api";
import { LoginForm } from "./login-form";
import { SignupForm } from "./signup-form";

function safeNext(next: string | null) {
  // Only allow same-origin relative paths (prevents open redirects).
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

type AuthMode = "login" | "signup";

const COPY: Record<AuthMode, { title: string; subtitle: string }> = {
  login: { title: "Sign in", subtitle: "Welcome back. Enter your details to continue." },
  signup: { title: "Create your account", subtitle: "Sign up to start planning projects with your team." },
};

/** Sign in / Sign up switch. Carries `?next=` across so the post-auth redirect survives. */
function AuthModeSwitch({ mode, next }: { mode: AuthMode; next: string | null }) {
  const query = next ? `?next=${encodeURIComponent(next)}` : "";
  const tabs = [
    { mode: "login" as const, label: "Sign in", href: `/login${query}` },
    { mode: "signup" as const, label: "Sign up", href: `/signup${query}` },
  ];
  return (
    <nav aria-label="Account" className="mb-7 grid grid-cols-2 gap-1 rounded-lg border border-line bg-panel-2 p-1">
      {tabs.map((tab) => (
        <Link
          key={tab.mode}
          href={tab.href}
          replace
          aria-current={tab.mode === mode ? "page" : undefined}
          className={cn(
            "rounded-md py-1.5 text-center text-sm font-medium transition",
            tab.mode === mode ? "bg-panel text-ink shadow-sm" : "text-ink-mute hover:text-ink",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

export function LoginScreen({ hasSession = true, mode = "login" }: { hasSession?: boolean; mode?: AuthMode }) {
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
    if (mode === "signup") toast.success("Account created", { description: `Welcome to TimeFlow, ${fullName(user)}.` });
    else toast.success("Signed in", { description: `Welcome back, ${fullName(user)}.` });
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

      {/* Sign-in / sign-up form */}
      <section className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          <AuthModeSwitch mode={mode} next={params.get("next")} />
          <h1 className="text-2xl font-semibold tracking-tight text-ink">{COPY[mode].title}</h1>
          <p className="mt-1 mb-7 text-sm text-ink-dim">{COPY[mode].subtitle}</p>
          {mode === "signup" ? <SignupForm onSuccess={handleSuccess} /> : <LoginForm onSuccess={handleSuccess} />}
        </div>
      </section>
    </div>
  );
}
