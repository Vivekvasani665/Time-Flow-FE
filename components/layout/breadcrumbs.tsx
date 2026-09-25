"use client";

import { ChevronRight, Home } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment } from "react";
import { shortId } from "@/lib/utils";

const LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  users: "Users",
  roles: "Roles",
  projects: "Projects",
  tasks: "Tasks",
  activity: "Activity log",
  emails: "Mailbox",
  settings: "Settings",
  system: "System",
  profile: "Profile",
  new: "Create",
  edit: "Edit",
  invite: "Invite",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-/i;

export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  const crumbs = segments.map((segment, i) => ({
    href: `/${segments.slice(0, i + 1).join("/")}`,
    label: UUID.test(segment) ? `#${shortId(segment)}` : (LABELS[segment] ?? segment),
    mono: UUID.test(segment),
  }));

  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1.5 text-sm">
        <li>
          <Link href="/dashboard" className="flex text-ink-mute hover:text-ink" aria-label="Home">
            <Home className="size-4" />
          </Link>
        </li>
        {crumbs.map((crumb, i) => {
          const last = i === crumbs.length - 1;
          return (
            <Fragment key={crumb.href}>
              <li aria-hidden="true">
                <ChevronRight className="size-3.5 text-ink-mute/60" />
              </li>
              <li className="min-w-0">
                {last ? (
                  <span
                    aria-current="page"
                    className={crumb.mono ? "tabular truncate text-ink" : "truncate font-medium text-ink"}
                  >
                    {crumb.label}
                  </span>
                ) : (
                  <Link
                    href={crumb.href}
                    className={crumb.mono ? "tabular truncate text-ink-mute hover:text-ink" : "truncate text-ink-mute hover:text-ink"}
                  >
                    {crumb.label}
                  </Link>
                )}
              </li>
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
