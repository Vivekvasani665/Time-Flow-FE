"use client";

import { ChevronDown, LogOut, Settings, UserCircle } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/components/auth/auth-provider";
import { Avatar } from "@/components/ui/avatar";
import { RankBadge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { fullName } from "@/lib/utils";

export function UserMenu() {
  const { user, logout } = useAuth();
  if (!user) return <Skeleton className="h-10 w-44" />;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="group flex items-center gap-2.5 rounded-lg py-1 pr-2 pl-1 transition hover:bg-panel-3 data-[state=open]:bg-panel-3">
        <Avatar user={user} size="sm" />
        <span className="hidden min-w-0 flex-col items-start text-left sm:flex">
          <span className="max-w-36 truncate text-sm leading-tight font-medium text-ink">{fullName(user)}</span>
          <span className="text-xs text-ink-mute">{user.role.name}</span>
        </span>
        <ChevronDown className="size-4 text-ink-mute transition group-data-[state=open]:rotate-180" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64">
        <div className="flex items-center gap-3 px-2.5 py-3">
          <Avatar user={user} size="md" />
          <div className="min-w-0">
            <p className="truncate font-medium">{fullName(user)}</p>
            <p className="truncate text-xs text-ink-mute">{user.email}</p>
            <RankBadge roleName={user.role.name} className="mt-1.5" />
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Account</DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link href="/profile">
            <UserCircle className="size-4" /> My profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings className="size-4" /> Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem icon={<LogOut />} destructive onSelect={() => void logout()}>
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
