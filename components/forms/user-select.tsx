"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useUserOptions } from "@/hooks/use-users";
import { cn, fullName } from "@/lib/utils";
import type { UserRef } from "@/types/api";

function mergeUsers(options: UserRef[] | undefined, extra: (UserRef | null | undefined)[]) {
  const map = new Map<string, UserRef>();
  for (const u of extra) if (u) map.set(u.id, u);
  for (const u of options ?? []) map.set(u.id, u);
  return [...map.values()].sort((a, b) => fullName(a).localeCompare(fullName(b)));
}

type UserSelectProps = {
  id: string;
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  placeholder?: string;
  allLabel?: string;
  /** Users that must be selectable even if not returned by /users/options (e.g. current value). */
  extra?: (UserRef | null | undefined)[];
  /** Restrict choices to this set (e.g. project members). */
  restrictTo?: UserRef[];
  invalid?: boolean;
  describedBy?: string;
  disabled?: boolean;
  className?: string;
};

export function UserSelect({ id, value, onChange, placeholder = "Select user", allLabel, extra = [], restrictTo, invalid, describedBy, disabled, className }: UserSelectProps) {
  const { data, isLoading } = useUserOptions("", !restrictTo);
  const users = restrictTo ? mergeUsers(restrictTo, extra) : mergeUsers(data, extra);
  return (
    <Select
      id={id}
      value={value}
      onValueChange={onChange}
      allLabel={allLabel}
      disabled={disabled || (!restrictTo && isLoading)}
      placeholder={!restrictTo && isLoading ? "Loading users…" : placeholder}
      options={users.map((u) => ({ value: u.id, label: `${fullName(u)} · ${u.email}` }))}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      className={className}
    />
  );
}

type UserMultiSelectProps = {
  id: string;
  value: string[];
  onChange: (value: string[]) => void;
  extra?: UserRef[];
  excludeIds?: string[];
};

export function UserMultiSelect({ id, value, onChange, extra = [], excludeIds = [] }: UserMultiSelectProps) {
  const [query, setQuery] = useState("");
  const { data, isLoading } = useUserOptions("");
  const users = useMemo(() => mergeUsers(data, extra), [data, extra]);
  const selected = new Set(value);
  const q = query.trim().toLowerCase();
  const visible = users.filter(
    (u) => !excludeIds.includes(u.id) && (!q || fullName(u).toLowerCase().includes(q) || u.email.toLowerCase().includes(q)),
  );

  const toggle = (userId: string) => {
    onChange(selected.has(userId) ? value.filter((v) => v !== userId) : [...value, userId]);
  };

  return (
    <div className="overflow-hidden rounded-lg border border-line-bright bg-panel shadow-sm">
      <div className="relative border-b border-line">
        <Search className="pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2 text-ink-mute" aria-hidden="true" />
        <input
          id={id}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search team members…"
          className="h-10 w-full bg-transparent pr-24 pl-9 text-sm outline-none placeholder:text-ink-mute"
          aria-label="Search members"
        />
        <span className="tabular absolute top-1/2 right-3 z-10 -translate-y-1/2 text-xs text-ink-mute">{value.length} selected</span>
      </div>
      <ul className="max-h-56 overflow-y-auto p-1" role="listbox" aria-multiselectable="true" aria-label="Members">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <li key={i} className="p-2">
              <Skeleton className="h-6" />
            </li>
          ))
        ) : visible.length === 0 ? (
          <li className="py-6 text-center text-sm text-ink-mute">No team members match your search.</li>
        ) : (
          visible.map((u) => {
            const checked = selected.has(u.id);
            return (
              <li key={u.id} role="option" aria-selected={checked}>
                <label
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-panel-3",
                    checked && "bg-cyan/5",
                  )}
                >
                  <Checkbox checked={checked} onCheckedChange={() => toggle(u.id)} aria-label={fullName(u)} />
                  <Avatar user={u} size="xs" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">{fullName(u)}</span>
                    <span className="block truncate text-xs text-ink-mute">{u.email}</span>
                  </span>
                </label>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
