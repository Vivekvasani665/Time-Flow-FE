"use client";

import { MoreHorizontal } from "lucide-react";
import type { ReactNode } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export function RowActions({ label, children }: { label: string; children: ReactNode }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex size-8 cursor-pointer items-center justify-center rounded-md text-ink-mute transition-colors hover:bg-panel-3 hover:text-ink data-[state=open]:bg-panel-3 data-[state=open]:text-ink"
        aria-label={label}
      >
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent>{children}</DropdownMenuContent>
    </DropdownMenu>
  );
}
