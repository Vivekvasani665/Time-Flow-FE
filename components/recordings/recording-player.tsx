"use client";

import { useEffect, useRef, type ComponentProps } from "react";
import { cn } from "@/lib/utils";

type Props = Omit<ComponentProps<"video">, "src" | "poster"> & {
  src: string;
  poster?: string | null;
  /** The signed URL stopped working (expired): fetch a fresh one. Playback resumes where it was. */
  onSourceExpired?: () => void;
};

/**
 * A <video> that copes with MediaRecorder output. Browsers write WebM without
 * a duration, so the player shows no length and can't seek until the file has
 * been scanned once; seeking far past the end forces that scan, after which
 * the real duration is known.
 */
export function RecordingPlayer({ src, poster, onSourceExpired, className, ...props }: Props) {
  const ref = useRef<HTMLVideoElement>(null);
  const resumeAt = useRef<{ time: number; playing: boolean } | null>(null);
  const expiredRef = useRef(onSourceExpired);
  useEffect(() => {
    expiredRef.current = onSourceExpired;
  });

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    let fixing = false;

    const onMetadata = () => {
      if (video.duration === Infinity || Number.isNaN(video.duration)) {
        fixing = true;
        video.currentTime = Number.MAX_SAFE_INTEGER;
      } else if (resumeAt.current) {
        video.currentTime = resumeAt.current.time;
        if (resumeAt.current.playing) void video.play().catch(() => undefined);
        resumeAt.current = null;
      }
    };
    const onDurationChange = () => {
      if (!fixing || !Number.isFinite(video.duration)) return;
      fixing = false;
      video.currentTime = resumeAt.current?.time ?? 0;
      if (resumeAt.current?.playing) void video.play().catch(() => undefined);
      resumeAt.current = null;
    };
    const onError = () => {
      if (!expiredRef.current) return;
      resumeAt.current = { time: video.currentTime, playing: !video.paused };
      expiredRef.current();
    };

    video.addEventListener("loadedmetadata", onMetadata);
    video.addEventListener("durationchange", onDurationChange);
    video.addEventListener("error", onError);
    return () => {
      video.removeEventListener("loadedmetadata", onMetadata);
      video.removeEventListener("durationchange", onDurationChange);
      video.removeEventListener("error", onError);
    };
  }, [src]);

  return (
    <video
      ref={ref}
      src={src}
      poster={poster ?? undefined}
      controls
      playsInline
      preload="metadata"
      className={cn("aspect-video w-full rounded-xl bg-black object-contain", className)}
      {...props}
    />
  );
}
