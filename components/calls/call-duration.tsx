"use client";

import { useEffect, useState } from "react";
import { formatTimer } from "@/lib/call-state";

/** The running call timer, from the moment media connected. */
export function CallDuration({ since, className }: { since: number; className?: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, []);
  const seconds = Math.max(0, (now - since) / 1000);
  return (
    <time className={className} dateTime={`PT${Math.floor(seconds)}S`} aria-label={`Call duration ${formatTimer(seconds)}`}>
      {formatTimer(seconds)}
    </time>
  );
}
