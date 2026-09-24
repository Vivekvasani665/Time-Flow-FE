"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { queryKeys } from "@/lib/query-keys";
import {
  applyPreferences,
  DEFAULT_PREFERENCES,
  normalise,
  readStoredPreferences,
  resolveTheme,
  storePreferences,
  type Preferences,
} from "@/lib/preferences";
import { preferencesService } from "@/services/preferences.service";
import { notifyError } from "@/lib/notify";

type PreferencesContextValue = {
  preferences: Preferences;
  /** "system" resolved against the OS — what the page is actually wearing. */
  resolvedTheme: "dark" | "light";
  update: (patch: Partial<Preferences>) => void;
};

const PreferencesContext = createContext<PreferencesContextValue>({
  preferences: DEFAULT_PREFERENCES,
  resolvedTheme: "light",
  update: () => {},
});

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  // Start from the same localStorage copy the inline script used, so state and
  // DOM agree from the first render.
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [resolvedTheme, setResolvedTheme] = useState<"dark" | "light">("light");

  /** Applies to the DOM, caches locally, and keeps the resolved theme in state. */
  const applyLocally = useCallback((next: Preferences) => {
    applyPreferences(next);
    storePreferences(next);
    setPreferences(next);
    setResolvedTheme(resolveTheme(next.theme));
  }, []);

  useEffect(() => {
    applyLocally(readStoredPreferences());
  }, [applyLocally]);

  // The server is the source of truth across devices: once /auth/me lands, its
  // copy wins and is cached locally for the next first paint.
  const serverPrefs = user?.preferences;
  useEffect(() => {
    if (!serverPrefs) return;
    applyLocally(normalise(serverPrefs));
  }, [serverPrefs, applyLocally]);

  // "system" has to keep tracking the OS while the tab is open. The listener
  // also updates React state, so anything reading resolvedTheme re-renders.
  useEffect(() => {
    if (preferences.theme !== "system") return;
    const mq = globalThis.matchMedia?.("(prefers-color-scheme: light)");
    if (!mq) return;
    const onChange = () => {
      applyPreferences(preferences);
      setResolvedTheme(resolveTheme(preferences.theme));
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [preferences]);

  // Saves are fire-and-forget and can land out of order, so only the newest
  // one is allowed to write back — otherwise a slow earlier response would
  // revert a setting the user has already changed again.
  const seqRef = useRef(0);

  const save = useMutation({
    mutationFn: ({ patch }: { patch: Partial<Preferences>; seq: number }) => preferencesService.update(patch),
    onSuccess: (saved, { seq }) => {
      if (seq !== seqRef.current) return;
      qc.setQueryData(queryKeys.me, (prev) => (prev ? { ...(prev as object), preferences: saved } : prev));
    },
    onError: (err, { seq }) => {
      if (seq !== seqRef.current) return;
      // Roll back to whatever the server last told us, so the UI never claims
      // a setting that was not persisted.
      applyLocally(normalise(serverPrefs));
      notifyError(err, { title: "Could not save settings" });
    },
  });

  const saveMutate = save.mutate;
  const update = useCallback(
    (patch: Partial<Preferences>) => {
      // Apply optimistically; the network write catches up.
      applyLocally(normalise({ ...preferences, ...patch }));
      seqRef.current += 1;
      saveMutate({ patch, seq: seqRef.current });
    },
    [preferences, applyLocally, saveMutate],
  );

  const value = useMemo(() => ({ preferences, resolvedTheme, update }), [preferences, resolvedTheme, update]);
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  return useContext(PreferencesContext);
}
