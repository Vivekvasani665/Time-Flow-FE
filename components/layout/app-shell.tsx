"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AuthProvider } from "@/components/auth/auth-provider";
import { PreferencesProvider } from "@/components/settings/preferences-provider";
import { cn } from "@/lib/utils";
import { BackgroundFx } from "./background-fx";
import { Header } from "./header";
import { Sidebar } from "./sidebar";

const COLLAPSE_KEY = "tf.sidebar.collapsed";

export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      localStorage.setItem(COLLAPSE_KEY, prev ? "0" : "1");
      return !prev;
    });
  };

  return (
    <AuthProvider>
      <PreferencesProvider>
      <BackgroundFx />
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[60] focus:rounded-md focus:bg-cyan focus:px-3 focus:py-2 focus:text-white">
        Skip to content
      </a>
      <Sidebar
        collapsed={collapsed}
        onToggleCollapsed={toggleCollapsed}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <div className={cn("flex min-h-dvh flex-col transition-[padding] duration-200", collapsed ? "lg:pl-[4.5rem]" : "lg:pl-60")}>
        <Header onOpenMobile={() => setMobileOpen(true)} />
        <main id="main" className="mx-auto w-full max-w-[1640px] flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
      </PreferencesProvider>
    </AuthProvider>
  );
}
