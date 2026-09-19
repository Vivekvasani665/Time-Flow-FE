"use client";

import { Lock } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { MODULE_LABELS, humanize } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { Permission } from "@/types/api";

const CRUD = ["view", "create", "update", "delete"] as const;

type PermissionMatrixProps = {
  catalog: Permission[];
  value: string[];
  onChange: (value: string[]) => void;
  readOnly?: boolean;
  /** Permissions the current user may grant; others are locked (escalation guard). */
  grantable?: Set<string>;
};

export function groupPermissions(catalog: Permission[]) {
  const groups = new Map<string, Permission[]>();
  for (const p of catalog) {
    const list = groups.get(p.module) ?? [];
    list.push(p);
    groups.set(p.module, list);
  }
  return [...groups.entries()];
}

export function PermissionMatrix({ catalog, value, onChange, readOnly, grantable }: PermissionMatrixProps) {
  const selected = new Set(value);
  const groups = groupPermissions(catalog);
  const canToggle = (key: string) => !readOnly && (!grantable || grantable.has(key));

  const setMany = (keys: string[], on: boolean) => {
    const next = new Set(selected);
    for (const key of keys) {
      if (!canToggle(key)) continue;
      if (on) next.add(key);
      else next.delete(key);
    }
    onChange([...next]);
  };

  const allKeys = catalog.map((p) => p.key);
  const allChecked = allKeys.length > 0 && allKeys.every((k) => selected.has(k));
  const someChecked = allKeys.some((k) => selected.has(k));

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-left">
        <caption className="sr-only">Permission matrix</caption>
        <thead>
          <tr className="border-b border-line bg-panel-2">
            <th scope="col" className="px-4 py-2.5">
              <label className="flex items-center gap-3">
                <Checkbox
                  checked={allChecked ? true : someChecked ? "indeterminate" : false}
                  onCheckedChange={(c) => setMany(allKeys, c === true)}
                  disabled={readOnly}
                  aria-label="Select all permissions"
                />
                <span className="text-xs font-medium text-ink-mute">Module</span>
              </label>
            </th>
            {CRUD.map((action) => (
              <th key={action} scope="col" className="px-3 py-2.5 text-center text-xs font-medium text-ink-mute">
                {humanize(action)}
              </th>
            ))}
            <th scope="col" className="px-4 py-2.5 text-xs font-medium text-ink-mute">
              Other
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {groups.map(([module, perms]) => {
            const keys = perms.map((p) => p.key);
            const checkedCount = keys.filter((k) => selected.has(k)).length;
            const moduleLabel = MODULE_LABELS[module] ?? humanize(module);
            const extras = perms.filter((p) => !CRUD.includes(p.action as (typeof CRUD)[number]));
            return (
              <tr key={module} className="transition-colors hover:bg-panel-2">
                <th scope="row" className="px-4 py-3 font-normal">
                  <label className="flex items-center gap-3">
                    <Checkbox
                      checked={checkedCount === keys.length ? true : checkedCount > 0 ? "indeterminate" : false}
                      onCheckedChange={(c) => setMany(keys, c === true)}
                      disabled={readOnly}
                      aria-label={`Select all ${moduleLabel} permissions`}
                    />
                    <span className="text-sm font-medium text-ink">{moduleLabel}</span>
                    <span className="tabular text-xs text-ink-mute">
                      {checkedCount}/{keys.length}
                    </span>
                  </label>
                </th>
                {CRUD.map((action) => {
                  const perm = perms.find((p) => p.action === action);
                  return (
                    <td key={action} className="px-3 py-3 text-center">
                      {perm ? (
                        <PermissionToggle
                          perm={perm}
                          checked={selected.has(perm.key)}
                          disabled={!canToggle(perm.key)}
                          locked={!readOnly && !canToggle(perm.key)}
                          onChange={(on) => setMany([perm.key], on)}
                          label={`${moduleLabel}: ${humanize(action)}`}
                          center
                        />
                      ) : (
                        <span className="text-ink-mute/50">—</span>
                      )}
                    </td>
                  );
                })}
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-x-5 gap-y-2">
                    {extras.length === 0 && <span className="text-ink-mute/50">—</span>}
                    {extras.map((perm) => (
                      <label key={perm.key} className="flex items-center gap-2 text-sm text-ink-dim" title={perm.description ?? perm.key}>
                        <PermissionToggle
                          perm={perm}
                          checked={selected.has(perm.key)}
                          disabled={!canToggle(perm.key)}
                          locked={!readOnly && !canToggle(perm.key)}
                          onChange={(on) => setMany([perm.key], on)}
                          label={`${moduleLabel}: ${humanize(perm.action)}`}
                        />
                        {humanize(perm.action)}
                      </label>
                    ))}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PermissionToggle({
  perm,
  checked,
  disabled,
  locked,
  onChange,
  label,
  center,
}: {
  perm: Permission;
  checked: boolean;
  disabled: boolean;
  locked: boolean;
  onChange: (on: boolean) => void;
  label: string;
  center?: boolean;
}) {
  return (
    <span className={cn("relative inline-flex", center && "justify-center")} title={locked ? "You can't grant a permission you don't hold" : (perm.description ?? perm.key)}>
      <Checkbox checked={checked} disabled={disabled} onCheckedChange={(c) => onChange(c === true)} aria-label={label} />
      {locked && <Lock className="absolute -top-1.5 -right-2.5 size-3 text-ink-mute" aria-hidden="true" />}
    </span>
  );
}
