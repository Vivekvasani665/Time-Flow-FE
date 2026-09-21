"use client";

import { useQueryClient } from "@tanstack/react-query";
import { BarChart3, CalendarDays, Check, Mail, SquareCheckBig, Users } from "lucide-react";
import { Caveat } from "next/font/google";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";
import { queryKeys } from "@/lib/query-keys";
import { cn, fullName } from "@/lib/utils";
import { authService } from "@/services/auth.service";
import type { AuthUser } from "@/types/api";
import { LoginForm } from "./login-form";
import { SignupForm } from "./signup-form";

const handwriting = Caveat({ subsets: ["latin"], weight: ["500"], display: "swap" });

function safeNext(next: string | null) {
  // Only allow same-origin relative paths (prevents open redirects).
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

type AuthMode = "login" | "signup";

const COPY: Record<AuthMode, { title: string; subtitle: string; wave?: boolean }> = {
  login: { title: "Welcome back", subtitle: "Enter your details to access your account.", wave: true },
  signup: { title: "Create your account", subtitle: "Sign up to start planning projects with your team." },
};

const FEATURES = [
  { icon: Users, title: "Role-based access control", body: "Keep your team secure and organized.", tone: "text-blue bg-blue/10" },
  { icon: SquareCheckBig, title: "Task and project tracking", body: "Stay on top of deadlines and progress.", tone: "text-lime bg-lime/10" },
  { icon: Mail, title: "Email notifications", body: "Get updates and never miss important changes.", tone: "text-violet bg-violet/10" },
] as const;

function BrandMark({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-4", className)}>
      <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-cyan text-white shadow-lg shadow-cyan/25" aria-hidden="true">
        <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round">
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 7.5V12l3 2" />
        </svg>
      </span>
      <div>
        <p className="text-2xl leading-none font-bold tracking-tight text-ink">
          Time<span className="text-cyan">Flow</span>
        </p>
        <p className="mt-1.5 text-xs text-ink-mute">Plan · Track · Achieve</p>
      </div>
    </div>
  );
}

/** Decorative app preview: a tilted dashboard window with floating calendar, check and chart tiles. */
function DashboardPreview() {
  const dots = ["bg-cyan", "bg-cyan", "bg-lime", "bg-violet", "bg-cyan", "bg-lime", "bg-amber", "bg-violet"];
  return (
    <div className="relative size-full" aria-hidden="true">
      <div className="absolute inset-[8%] rounded-full bg-cyan/[0.06] blur-2xl" />

      <div className="absolute top-[22%] left-[10%] w-[80%] [transform:perspective(1200px)_rotateY(-14deg)_rotateX(6deg)_rotate(-2deg)]">
        <div className="flex overflow-hidden rounded-xl border border-line bg-panel shadow-[0_30px_60px_-20px_rgb(49_46_129/0.35)]">
          <div className="w-[14%] space-y-2 bg-[#1e2a52] p-2">
            <div className="flex gap-0.5 pb-1">
              <span className="size-1 rounded-full bg-[#f87171]" />
              <span className="size-1 rounded-full bg-[#fbbf24]" />
              <span className="size-1 rounded-full bg-[#34d399]" />
            </div>
            <div className="mx-auto size-4 rounded bg-cyan" />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="mx-auto h-1 w-3/4 rounded bg-white/20" />
            ))}
          </div>
          <div className="flex-1 space-y-2.5 p-3">
            <div className="flex gap-2">
              <div className="h-4 flex-1 rounded bg-panel-3" />
              <div className="h-4 flex-1 rounded bg-panel-3" />
              <div className="h-4 w-1/4 rounded bg-panel-3" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[0, 1].map((col) => (
                <div key={col} className="space-y-2 rounded-md bg-panel-2 p-2">
                  <div className="h-1 w-1/3 rounded bg-line-bright" />
                  {dots.slice(col * 4, col * 4 + 4).map((dot, i) => (
                    <div key={i} className="flex items-center gap-1.5 rounded bg-panel p-1.5">
                      <span className={cn("size-2 shrink-0 rounded-full", dot)} />
                      <div className="flex-1 space-y-1">
                        <div className="h-1 w-3/4 rounded bg-line-bright" />
                        <div className="h-1 w-1/2 rounded bg-line" />
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="absolute top-[8%] left-[32%] flex size-14 items-center justify-center rounded-xl border border-line bg-panel text-cyan shadow-lg">
        <CalendarDays className="size-7" strokeWidth={1.75} />
      </div>
      <div className="absolute top-[15%] right-[12%] flex size-8 items-center justify-center rounded-full bg-lime text-white shadow-md">
        <Check className="size-4" strokeWidth={3} />
      </div>
      <div className="absolute right-[8%] bottom-[14%] flex size-18 items-center justify-center rounded-xl border border-line bg-panel text-cyan shadow-lg">
        <BarChart3 className="size-9" strokeWidth={2.5} />
      </div>
    </div>
  );
}

/** Sign in / Sign up switch. Carries `?next=` across so the post-auth redirect survives. */
function AuthModeSwitch({ mode, next }: { mode: AuthMode; next: string | null }) {
  const query = next ? `?next=${encodeURIComponent(next)}` : "";
  const tabs = [
    { mode: "login" as const, label: "Sign in", href: `/login${query}` },
    { mode: "signup" as const, label: "Sign up", href: `/signup${query}` },
  ];
  return (
    <nav aria-label="Account" className="mb-8 grid grid-cols-2 gap-1 rounded-xl border border-line bg-panel-2 p-1">
      {tabs.map((tab) => (
        <Link
          key={tab.mode}
          href={tab.href}
          replace
          aria-current={tab.mode === mode ? "page" : undefined}
          className={cn(
            "rounded-lg py-2.5 text-center text-sm font-medium transition",
            tab.mode === mode ? "bg-cyan text-white shadow-sm shadow-cyan/30" : "text-ink-mute hover:text-ink",
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

  const copy = COPY[mode];

  return (
    <div className="grid min-h-dvh bg-void lg:grid-cols-[1.15fr_1fr]">
      {/* Brand panel */}
      <section
        className="relative hidden flex-col overflow-hidden px-12 pt-12 pb-10 lg:flex xl:px-16"
        style={{ background: "linear-gradient(160deg, color-mix(in oklab, var(--color-cyan) 4%, var(--color-panel)) 0%, color-mix(in oklab, var(--color-cyan) 9%, var(--color-void)) 100%)" }}
      >
        <BrandMark />

        <div className="relative z-10 mt-16 max-w-xl">
          <h2 className="text-[2.6rem] leading-[1.15] font-bold tracking-tight text-ink">
            Plan projects, assign work and keep your team in{" "}
            <span className="relative inline-block text-cyan">
              sync
              <svg viewBox="0 0 100 12" preserveAspectRatio="none" className="absolute -bottom-2 left-0 h-2.5 w-full text-cyan" aria-hidden="true">
                <path d="M2 9 C 30 2, 70 2, 98 8" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
            </span>
            .
          </h2>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-ink-dim">
            One workspace for projects, tasks, people and permissions — with an audit trail for every change.
          </p>

          <ul className="mt-10 space-y-6">
            {FEATURES.map(({ icon: Icon, title, body, tone }) => (
              <li key={title} className="flex items-center gap-5">
                <span className={cn("flex size-14 shrink-0 items-center justify-center rounded-2xl", tone)} aria-hidden="true">
                  <Icon className="size-6" />
                </span>
                <div>
                  <p className="font-medium text-ink">{title}</p>
                  <p className="mt-0.5 text-sm text-ink-mute">{body}</p>
                </div>
              </li>
            ))}
          </ul>

          <p className={cn(handwriting.className, "mt-12 ml-14 flex items-end gap-4 text-xl leading-tight text-cyan")}>
            <span className="-rotate-3">
              Better teamwork
              <br />
              builds bigger goals
            </span>
            <svg viewBox="0 0 70 40" className="mb-3 h-9 w-16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M2 32 C 22 42, 50 30, 64 6" />
              <path d="M52 8 L 65 5 L 64 18" />
            </svg>
          </p>
        </div>

        {/* App preview, only where there is room beside the copy */}
        <div className="pointer-events-none absolute top-[18%] right-0 hidden aspect-square w-[42%] max-w-md 2xl:block">
          <DashboardPreview />
        </div>

        {/* Soft wave along the bottom */}
        <svg viewBox="0 0 1000 240" preserveAspectRatio="none" className="pointer-events-none absolute inset-x-0 bottom-0 h-56 w-full text-cyan" aria-hidden="true">
          <path d="M0 60 C 250 200, 600 20, 1000 110 L 1000 240 L 0 240 Z" fill="currentColor" opacity="0.06" />
          <path d="M0 150 C 300 240, 650 90, 1000 170 L 1000 240 L 0 240 Z" fill="currentColor" opacity="0.05" />
        </svg>

        <p className="relative z-10 mt-auto pt-10 text-xs text-ink-mute">© {new Date().getFullYear()} TimeFlow</p>
      </section>

      {/* Sign-in / sign-up card */}
      <section className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-[34rem]">
          <BrandMark className="mb-8 lg:hidden" />
          <div className="rounded-3xl border border-line bg-panel p-6 shadow-[0_20px_50px_-24px_rgb(49_46_129/0.25)] sm:p-10">
            <AuthModeSwitch mode={mode} next={params.get("next")} />
            <h1 className="flex items-center gap-2.5 text-3xl font-bold tracking-tight text-ink">
              {copy.wave && <span aria-hidden="true">👋</span>}
              {copy.title}
            </h1>
            <p className="mt-2 mb-8 text-ink-mute">{copy.subtitle}</p>
            {mode === "signup" ? <SignupForm onSuccess={handleSuccess} /> : <LoginForm onSuccess={handleSuccess} />}
          </div>
        </div>
      </section>
    </div>
  );
}
