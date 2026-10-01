"use client";

import { Circle, Minimize2, Square, Video } from "lucide-react";
import { useRef, useState, type PointerEvent } from "react";
import { StreamVideo } from "@/components/calls/stream-media";
import type { WebcamLayout, WebcamPosition, WebcamSize } from "@/lib/recording/compositor";
import { cn } from "@/lib/utils";

/** On-page bubble size per layout size, in px. */
const BUBBLE_PX: Record<WebcamSize, number> = { sm: 112, md: 152, lg: 208 };
const NEXT_SIZE: Record<WebcamSize, WebcamSize> = { sm: "md", md: "lg", lg: "sm" };

const CORNER_CLASS: Record<WebcamPosition, string> = {
  "top-left": "top-20 left-4 lg:left-[16.5rem]",
  "top-right": "top-20 right-4",
  "bottom-left": "bottom-20 left-4 lg:left-[16.5rem]",
  "bottom-right": "bottom-20 right-4",
};

type Props = {
  stream: MediaStream;
  layout: WebcamLayout;
  onLayoutChange: (layout: WebcamLayout) => void;
  cameraOn: boolean;
  /** Camera-only recordings: the bubble is the whole picture, so it is shown as a larger card. */
  cameraOnly?: boolean;
  /** Start collapsed, e.g. when this very tab is being recorded (it would show twice). */
  defaultMinimized?: boolean;
};

/**
 * Your own camera while recording. Its corner, size and shape are the same
 * layout the recording is drawn with, so moving the bubble here moves it in
 * the video: drag it to any corner, click the size or shape buttons.
 * Mirrored like a mirror, as self-view usually is; the recording is not.
 */
export function WebcamOverlay({ stream, layout, onLayoutChange, cameraOn, cameraOnly, defaultMinimized = false }: Props) {
  const [minimized, setMinimized] = useState(defaultMinimized);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const start = useRef<{ x: number; y: number; dx: number; dy: number } | null>(null);
  const size = cameraOnly ? 280 : BUBBLE_PX[layout.size];

  if (minimized) {
    return (
      <button
        type="button"
        onClick={() => setMinimized(false)}
        className={cn("fixed z-[65] flex cursor-pointer items-center gap-2 rounded-full bg-[#141a3a]/95 px-3 py-2 text-xs font-medium text-white shadow-lg", CORNER_CLASS[layout.position])}
      >
        <Video className="size-3.5" aria-hidden="true" />
        Show camera
      </button>
    );
  }

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button")) return;
    const rect = e.currentTarget.getBoundingClientRect();
    start.current = { x: e.clientX, y: e.clientY, dx: e.clientX - rect.left, dy: e.clientY - rect.top };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!start.current) return;
    if (!drag && Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) < 4) return;
    setDrag({ x: e.clientX - start.current.dx, y: e.clientY - start.current.dy });
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (!start.current) return;
    start.current = null;
    if (!drag) return;
    // Snap to the nearest corner.
    const cx = drag.x + size / 2;
    const cy = drag.y + size / 2;
    const vertical = cy < window.innerHeight / 2 ? "top" : "bottom";
    const horizontal = cx < window.innerWidth / 2 ? "left" : "right";
    setDrag(null);
    e.currentTarget.releasePointerCapture(e.pointerId);
    onLayoutChange({ ...layout, position: `${vertical}-${horizontal}` as WebcamPosition });
  };

  const round = !cameraOnly && layout.shape === "circle";
  return (
    <div
      className={cn("group fixed z-[65] touch-none select-none", !drag && CORNER_CLASS[layout.position], drag ? "cursor-grabbing" : "cursor-grab", !drag && "transition-[width,height] duration-200")}
      style={{ width: size, height: cameraOnly ? (size * 9) / 16 : size, ...(drag ? { left: drag.x, top: drag.y } : {}) }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      aria-label="Your camera"
    >
      <div className={cn("size-full overflow-hidden border-[3px] border-white bg-[#141a3a] shadow-[var(--shadow-dialog)]", round ? "rounded-full" : "rounded-2xl")}>
        {cameraOn ? (
          <StreamVideo stream={stream} muted className="size-full -scale-x-100 object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center text-xs text-white/70">Camera off</div>
        )}
      </div>
      <div className="absolute -top-3 left-1/2 flex -translate-x-1/2 gap-1 rounded-full bg-[#141a3a]/95 p-1 opacity-0 shadow-lg transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        {!cameraOnly && (
          <>
            <button
              type="button"
              onClick={() => onLayoutChange({ ...layout, shape: layout.shape === "circle" ? "rounded" : "circle" })}
              className="flex size-7 cursor-pointer items-center justify-center rounded-full text-white/80 hover:bg-white/10 hover:text-white"
              aria-label={layout.shape === "circle" ? "Make camera square" : "Make camera round"}
              title="Shape"
            >
              {layout.shape === "circle" ? <Square className="size-3.5" /> : <Circle className="size-3.5" />}
            </button>
            <button
              type="button"
              onClick={() => onLayoutChange({ ...layout, size: NEXT_SIZE[layout.size] })}
              className="flex h-7 min-w-7 cursor-pointer items-center justify-center rounded-full px-1.5 text-xs font-semibold text-white/80 uppercase hover:bg-white/10 hover:text-white"
              aria-label={`Camera size ${layout.size.toUpperCase()}, change size`}
              title="Size"
            >
              {layout.size === "md" ? "M" : layout.size === "sm" ? "S" : "L"}
            </button>
          </>
        )}
        <button
          type="button"
          onClick={() => setMinimized(true)}
          className="flex size-7 cursor-pointer items-center justify-center rounded-full text-white/80 hover:bg-white/10 hover:text-white"
          aria-label="Hide camera preview (keeps recording)"
          title="Hide preview"
        >
          <Minimize2 className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
