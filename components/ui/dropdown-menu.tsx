"use client";

import * as Menu from "@radix-ui/react-dropdown-menu";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

export const DropdownMenu = Menu.Root;
export const DropdownMenuTrigger = Menu.Trigger;

export function DropdownMenuContent({ className, align = "end", ...props }: ComponentProps<typeof Menu.Content>) {
  return (
    <Menu.Portal>
      <Menu.Content
        align={align}
        sideOffset={6}
        className={cn(
          "z-50 min-w-44 rounded-lg border border-line bg-panel p-1 shadow-[var(--shadow-overlay)] animate-fade-up",
          className,
        )}
        {...props}
      />
    </Menu.Portal>
  );
}

type ItemProps = ComponentProps<typeof Menu.Item> & { icon?: ReactNode; destructive?: boolean };

export function DropdownMenuItem({ className, icon, destructive, children, ...props }: ItemProps) {
  // With asChild, Radix's Slot needs exactly one child element — callers put icons inside it.
  const content = props.asChild ? (
    children
  ) : (
    <>
      {icon && <span className="[&>svg]:size-4">{icon}</span>}
      {children}
    </>
  );
  return (
    <Menu.Item
      className={cn(
        "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none select-none",
        destructive
          ? "text-danger data-[highlighted]:bg-danger/10"
          : "text-ink data-[highlighted]:bg-panel-3 [&_svg]:text-ink-mute",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-40",
        className,
      )}
      {...props}
    >
      {content}
    </Menu.Item>
  );
}

export function DropdownMenuSeparator() {
  return <Menu.Separator className="my-1 h-px bg-line" />;
}

export function DropdownMenuLabel({ children }: { children: ReactNode }) {
  return (
    <Menu.Label className="px-2 py-1.5 text-xs font-medium text-ink-mute">{children}</Menu.Label>
  );
}
