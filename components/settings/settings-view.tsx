"use client";

import { Check, Moon, Monitor, Palette, Rows3, Sun } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { usePreferences } from "@/components/settings/preferences-provider";
import { SessionsPanel } from "@/components/settings/sessions-panel";
import { cn } from "@/lib/utils";
import type { Accent, Density, Theme } from "@/lib/preferences";

const THEME_OPTIONS: { value: Theme; label: string; hint: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", hint: "Light backgrounds with dark text", icon: Sun },
  { value: "dark", label: "Dark", hint: "Dark backgrounds, easier on the eyes at night", icon: Moon },
  { value: "system", label: "System", hint: "Match your operating system setting", icon: Monitor },
];

/** Swatches use literal hex, not tokens — they must show the colour they name. */
const ACCENT_OPTIONS: { value: Accent; label: string; dark: string; light: string }[] = [
  { value: "cyan", label: "Indigo", dark: "#818cf8", light: "#4f46e5" },
  { value: "violet", label: "Violet", dark: "#a78bfa", light: "#7c3aed" },
  { value: "magenta", label: "Rose", dark: "#fb7185", light: "#e11d48" },
  { value: "lime", label: "Emerald", dark: "#34d399", light: "#059669" },
  { value: "amber", label: "Amber", dark: "#fbbf24", light: "#d97706" },
];

const DENSITY_OPTIONS: { value: Density; label: string; hint: string }[] = [
  { value: "comfortable", label: "Comfortable", hint: "Roomier rows, easier to scan" },
  { value: "compact", label: "Compact", hint: "More rows on screen at once" },
];

export function SettingsView() {
  const { preferences, resolvedTheme, update } = usePreferences();
  // Swatches must show the hue actually in force, so follow the *resolved*
  // theme — "system" on a light OS renders the light palette.
  const isLight = resolvedTheme === "light";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Personalize how TimeFlow looks. Changes apply instantly and sync across your devices."
      />

      <Panel title="Theme" subtitle="Choose how the interface looks" icon={<Sun />}>
        <div className="grid gap-3 sm:grid-cols-3">
          {THEME_OPTIONS.map(({ value, label, hint, icon: Icon }) => {
            const active = preferences.theme === value;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={active}
                onClick={() => update({ theme: value })}
                className={cn(
                  "cursor-pointer rounded-lg border p-4 text-left transition-colors",
                  active ? "border-cyan bg-cyan/5" : "border-line hover:border-line-bright hover:bg-panel-2",
                )}
              >
                <span className="flex items-center justify-between">
                  <Icon className={cn("size-5", active ? "text-cyan" : "text-ink-mute")} />
                  {active && <Check className="size-4 text-cyan" />}
                </span>
                <span className="mt-3 block text-sm font-medium text-ink">{label}</span>
                <span className="mt-1 block text-xs text-ink-mute">{hint}</span>
              </button>
            );
          })}
        </div>
      </Panel>

      <Panel title="Accent colour" subtitle="Used for buttons, links and highlights" icon={<Palette />}>
        <div className="flex flex-wrap gap-3">
          {ACCENT_OPTIONS.map(({ value, label, dark, light }) => {
            const active = preferences.accent === value;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={active}
                aria-label={label}
                title={label}
                onClick={() => update({ accent: value })}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-lg border px-3.5 py-2.5 transition-colors",
                  active ? "border-cyan bg-cyan/5" : "border-line hover:border-line-bright hover:bg-panel-2",
                )}
              >
                <span
                  className="size-4 rounded-full ring-1 ring-black/10 ring-inset"
                  style={{ background: isLight ? light : dark }}
                  aria-hidden="true"
                />
                <span className="text-sm font-medium text-ink">{label}</span>
                {active && <Check className="size-3.5 text-cyan" />}
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-ink-mute">
          Applies to active states, focus rings and charts across the app.
        </p>
      </Panel>

      <Panel title="Density" subtitle="Row spacing in tables and lists" icon={<Rows3 />}>
        <div className="grid gap-3 sm:grid-cols-2">
          {DENSITY_OPTIONS.map(({ value, label, hint }) => {
            const active = preferences.density === value;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={active}
                onClick={() => update({ density: value })}
                className={cn(
                  "cursor-pointer rounded-lg border p-4 text-left transition-colors",
                  active ? "border-cyan bg-cyan/5" : "border-line hover:border-line-bright hover:bg-panel-2",
                )}
              >
                <span className="flex items-center justify-between">
                  <span className="text-sm font-medium text-ink">{label}</span>
                  {active && <Check className="size-4 text-cyan" />}
                </span>
                <span className="mt-1 block text-xs text-ink-mute">{hint}</span>
                {/* Preview rows, sized by the same token the tables use. */}
                <span className="mt-3 block divide-y divide-line overflow-hidden rounded-md border border-line bg-panel">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="block px-3 text-xs text-ink-dim"
                      style={{ paddingBlock: value === "compact" ? "0.375rem" : "0.75rem" }}
                    >
                      Row {i + 1}
                    </span>
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </Panel>

      <SessionsPanel />
    </div>
  );
}
