"use client";

import { Menu } from "lucide-react";
import { Breadcrumbs } from "./breadcrumbs";
import { NotificationsBell } from "./notifications-bell";
import { UserMenu } from "./user-menu";

export function Header({ onOpenMobile }: { onOpenMobile: () => void }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-panel/85 px-4 backdrop-blur sm:px-6">
      <button
        onClick={onOpenMobile}
        className="flex size-9 items-center justify-center rounded-lg border border-line text-ink-dim hover:bg-panel-3 hover:text-ink lg:hidden"
        aria-label="Open menu"
      >
        <Menu className="size-5" />
      </button>
      <div className="hidden min-w-0 flex-1 sm:block">
        <Breadcrumbs />
      </div>
      <div className="ml-auto flex items-center gap-2">
        <NotificationsBell />
        <UserMenu />
      </div>
    </header>
  );
}
