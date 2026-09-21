/**
 * UI preferences. The server owns them (they ride along with /auth/me), but a
 * localStorage copy is what paints the first frame — see the inline script in
 * app/layout.tsx. Without that copy every reload would flash the default theme.
 */

export type Theme = "dark" | "light" | "system";
export type Accent = "cyan" | "violet" | "magenta" | "lime" | "amber";
export type Density = "comfortable" | "compact";

export type Preferences = { theme: Theme; accent: Accent; density: Density };

export const DEFAULT_PREFERENCES: Preferences = { theme: "light", accent: "cyan", density: "comfortable" };

export const THEMES: Theme[] = ["light", "dark", "system"];
export const ACCENTS: Accent[] = ["cyan", "violet", "magenta", "lime", "amber"];
export const DENSITIES: Density[] = ["comfortable", "compact"];

/** Matches the key convention already in use (tf.sidebar.collapsed, tf.sessionExpiresAt). */
export const PREFERENCES_KEY = "tf.preferences";

function isTheme(v: unknown): v is Theme {
  return typeof v === "string" && (THEMES as string[]).includes(v);
}
function isAccent(v: unknown): v is Accent {
  return typeof v === "string" && (ACCENTS as string[]).includes(v);
}
function isDensity(v: unknown): v is Density {
  return typeof v === "string" && (DENSITIES as string[]).includes(v);
}

/** Unknown or missing fields fall back to the default rather than throwing. */
export function normalise(value: unknown): Preferences {
  const v = (value ?? {}) as Partial<Record<keyof Preferences, unknown>>;
  return {
    theme: isTheme(v.theme) ? v.theme : DEFAULT_PREFERENCES.theme,
    accent: isAccent(v.accent) ? v.accent : DEFAULT_PREFERENCES.accent,
    density: isDensity(v.density) ? v.density : DEFAULT_PREFERENCES.density,
  };
}

/** Storage throws in private mode, so every access is guarded. */
export function readStoredPreferences(): Preferences {
  try {
    const raw = globalThis.localStorage?.getItem(PREFERENCES_KEY);
    return normalise(raw ? JSON.parse(raw) : null);
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function storePreferences(prefs: Preferences): void {
  try {
    globalThis.localStorage?.setItem(PREFERENCES_KEY, JSON.stringify(prefs));
  } catch {
    /* storage unavailable (private mode) — the server copy still persists */
  }
}

/** "system" follows the OS; everything else is an explicit choice. */
export function resolveTheme(theme: Theme): "dark" | "light" {
  if (theme !== "system") return theme;
  try {
    return globalThis.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
  } catch {
    return "dark";
  }
}

/** Stamps the three attributes the CSS in globals.css selects on. */
export function applyPreferences(prefs: Preferences): void {
  const root = document.documentElement;
  root.dataset.theme = resolveTheme(prefs.theme);
  // The accent picker was removed; always use the default so an old saved choice can't stick.
  root.dataset.accent = DEFAULT_PREFERENCES.accent;
  root.dataset.density = prefs.density;
}
