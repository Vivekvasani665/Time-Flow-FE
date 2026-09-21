"use client";

import { ChevronsLeft, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePermissions } from "@/components/auth/auth-provider";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";
import { NAV_ITEMS } from "./nav-items";

type SidebarProps = {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
};

export function Sidebar({ collapsed, onToggleCollapsed, mobileOpen, onCloseMobile }: SidebarProps) {
  const pathname = usePathname();
  const { can } = usePermissions();
  const items = NAV_ITEMS.filter((item) => !item.permission || can(item.permission));

  return (
    <>
      {mobileOpen && <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={onCloseMobile} aria-hidden="true" />}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col bg-[linear-gradient(180deg,#141a3a_0%,#161d45_70%,#1c2358_100%)] text-white transition-[width,transform] duration-200",
          "w-72 -translate-x-full lg:translate-x-0",
          mobileOpen && "translate-x-0",
          collapsed ? "lg:w-[4.5rem]" : "lg:w-60",
        )}
        aria-label="Main navigation"
      >
        <div className={cn("flex h-16 items-center px-5", collapsed && "lg:justify-center lg:px-0")}>
          <Link href="/dashboard" onClick={onCloseMobile} aria-label="TimeFlow dashboard" className="[&_span]:!text-white">
            <Logo compact={collapsed} />
          </Link>
          <button onClick={onCloseMobile} className="ml-auto rounded-md p-2 text-white/60 hover:bg-white/10 hover:text-white lg:hidden" aria-label="Close menu">
            <X className="size-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 pt-4">
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onCloseMobile}
                aria-current={active ? "page" : undefined}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "flex h-11 items-center gap-3 rounded-xl px-3.5 text-[0.9375rem] font-medium transition-colors",
                  collapsed && "lg:justify-center lg:px-0",
                  active ? "bg-cyan text-white shadow-lg shadow-cyan/30" : "text-white/70 hover:bg-white/[0.06] hover:text-white",
                )}
              >
                <Icon className="size-[18px] shrink-0" />
                <span className={cn("truncate", collapsed && "lg:hidden")}>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className={cn("border-t border-white/10 p-3", collapsed && "lg:px-2")}>
          <button
            onClick={onToggleCollapsed}
            className="hidden h-9 w-full items-center justify-center gap-2 rounded-lg text-sm text-white/55 transition hover:bg-white/[0.06] hover:text-white lg:flex"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <ChevronsLeft className={cn("size-4 transition-transform", collapsed && "rotate-180")} />
            <span className={cn(collapsed && "hidden")}>Collapse</span>
          </button>
        </div>
      </aside>
    </>
  );
}
