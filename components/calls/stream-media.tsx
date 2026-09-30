"use client";

import { useEffect, useRef, type ComponentProps } from "react";

/** A <video> or <audio> playing a MediaStream. React has no prop for srcObject, so it is set here. */
export function StreamVideo({ stream, ...props }: { stream: MediaStream | null } & ComponentProps<"video">) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);
  return <video ref={ref} autoPlay playsInline {...props} />;
}

/** Plays the other person's audio. Kept apart from the video so sound continues while the call is minimized. */
export function StreamAudio({ stream }: { stream: MediaStream | null }) {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);
  return <audio ref={ref} autoPlay data-testid="call-remote-audio" className="hidden" />;
}

/** Whether a stream carries video that is actually on. */
export const hasLiveVideo = (stream: MediaStream | null) => Boolean(stream?.getVideoTracks().some((t) => t.readyState !== "ended" && t.enabled));
