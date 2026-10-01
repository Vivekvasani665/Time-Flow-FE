"use client";

import { useEffect, useRef, useState } from "react";
import { explainCaptureError } from "@/lib/recording/media-support";

type Problem = { camera: string | null; microphone: string | null };

/**
 * A live camera and/or microphone stream for the recording setup screen, so
 * people see themselves and their mic level before they start. Opening it is
 * also what prompts for access, which unlocks real device names. Every track
 * is stopped when the inputs change or the screen closes.
 */
export function usePreviewStream({
  camera,
  microphone,
  enabled,
  onGranted,
}: {
  camera: string | null | false;
  microphone: string | null | false;
  enabled: boolean;
  /** Called once access is granted, e.g. to re-read device names. */
  onGranted?: () => void;
}) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [problem, setProblem] = useState<Problem>({ camera: null, microphone: null });
  const [level, setLevel] = useState(0);
  const onGrantedRef = useRef(onGranted);
  useEffect(() => {
    onGrantedRef.current = onGranted;
  });

  useEffect(() => {
    if (!enabled || (camera === false && microphone === false) || !navigator.mediaDevices?.getUserMedia) {
      setStream(null);
      return;
    }
    let cancelled = false;
    let opened: MediaStream | null = null;
    const open = async (kind: "camera" | "microphone") => {
      const id = kind === "camera" ? camera : microphone;
      if (id === false) return null;
      try {
        return await navigator.mediaDevices.getUserMedia(
          kind === "camera" ? { video: id ? { deviceId: { exact: id } } : { facingMode: "user" } } : { audio: id ? { deviceId: { exact: id } } : true },
        );
      } catch (error) {
        if (!cancelled) setProblem((p) => ({ ...p, [kind]: explainCaptureError(error, kind).message }));
        return null;
      }
    };
    setProblem({ camera: null, microphone: null });
    void (async () => {
      // Separately, so a missing camera doesn't also hide a working microphone.
      const [video, audio] = await Promise.all([open("camera"), open("microphone")]);
      const tracks = [...(video?.getTracks() ?? []), ...(audio?.getTracks() ?? [])];
      if (cancelled) {
        tracks.forEach((t) => t.stop());
        return;
      }
      opened = tracks.length ? new MediaStream(tracks) : null;
      setStream(opened);
      if (opened) onGrantedRef.current?.();
    })();
    return () => {
      cancelled = true;
      opened?.getTracks().forEach((t) => t.stop());
      setStream(null);
    };
  }, [enabled, camera, microphone]);

  // Microphone level meter.
  useEffect(() => {
    if (!stream?.getAudioTracks().length || typeof AudioContext === "undefined") {
      setLevel(0);
      return;
    }
    const context = new AudioContext();
    const analyser = context.createAnalyser();
    analyser.fftSize = 512;
    const source = context.createMediaStreamSource(stream);
    source.connect(analyser);
    const data = new Uint8Array(analyser.fftSize);
    const id = setInterval(() => {
      analyser.getByteTimeDomainData(data);
      let peak = 0;
      for (const v of data) peak = Math.max(peak, Math.abs(v - 128));
      setLevel(Math.min(1, peak / 64));
    }, 80);
    return () => {
      clearInterval(id);
      source.disconnect();
      void context.close().catch(() => undefined);
    };
  }, [stream]);

  return { stream, problem, level };
}
