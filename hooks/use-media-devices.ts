"use client";

import { useCallback, useEffect, useState } from "react";

export type DeviceOption = { deviceId: string; label: string };

/**
 * Cameras and microphones, kept current as devices are plugged in or out.
 * Browsers hide device names until the site has camera/microphone access, so
 * `named` says whether the labels are real or placeholders.
 */
export function useMediaDevices(active: boolean) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [loaded, setLoaded] = useState(false);
  const supported = typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.enumerateDevices);

  const refresh = useCallback(async () => {
    if (!supported) return;
    try {
      setDevices(await navigator.mediaDevices.enumerateDevices());
    } catch {
      setDevices([]);
    } finally {
      setLoaded(true);
    }
  }, [supported]);

  useEffect(() => {
    if (!active || !supported) return;
    void refresh();
    navigator.mediaDevices.addEventListener("devicechange", refresh);
    return () => navigator.mediaDevices.removeEventListener("devicechange", refresh);
  }, [active, supported, refresh]);

  const list = (kind: MediaDeviceKind, noun: string): DeviceOption[] =>
    devices.filter((d) => d.kind === kind).map((d, i) => ({ deviceId: d.deviceId, label: d.label || `${noun} ${i + 1}` }));

  return {
    supported,
    loaded,
    cameras: list("videoinput", "Camera"),
    microphones: list("audioinput", "Microphone"),
    /** Real device names are visible (access was granted at least once). */
    named: devices.some((d) => d.label),
    refresh,
  };
}
