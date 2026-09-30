"use client";

import { Maximize, Maximize2, Mic, MicOff, Minimize, Minimize2, PhoneOff, RotateCcw, Video, VideoOff, WifiOff, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
import { formatCallDuration, isTerminal, type CallSession } from "@/lib/call-state";
import { cn, fullName } from "@/lib/utils";
import type { RemoteMedia } from "./call-provider";
import { CallDuration } from "./call-duration";
import { hasLiveVideo, StreamAudio, StreamVideo } from "./stream-media";

type ActiveCallProps = {
  session: CallSession;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  remoteMedia: RemoteMedia;
  onEnd: () => void;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onDismiss: () => void;
  onCallAgain: () => void;
};

/** One line on where the call stands, for sighted users and screen readers alike. */
function statusText(session: CallSession): string {
  if (isTerminal(session.phase)) return session.message ?? "Call ended.";
  if (session.reconnecting) return "Reconnecting…";
  switch (session.phase) {
    case "OUTGOING":
      return session.type === "VIDEO" ? "Starting camera…" : "Starting microphone…";
    case "RINGING":
      return "Ringing…";
    case "ACCEPTED":
    case "CONNECTING":
      return "Connecting…";
    default:
      return "Connected";
  }
}

function ControlButton({
  label,
  onClick,
  pressed,
  danger,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  pressed?: boolean;
  danger?: boolean;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      disabled={disabled}
      className={cn(
        "flex size-12 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none disabled:opacity-40 sm:size-14",
        danger
          ? "bg-danger text-white hover:opacity-90"
          : pressed
            ? "bg-white text-[#0b0d12] hover:bg-white/90"
            : "bg-white/15 text-white hover:bg-white/25",
      )}
    >
      {children}
    </button>
  );
}

/**
 * The call in progress (and its outcome). Video: the other person fills the
 * panel, this device's camera is a small mirrored preview. Voice: avatar,
 * name, status and timer. It can be minimized to a floating bar so the rest
 * of TimeFlow stays usable during a call.
 */
export function ActiveCall({ session, localStream, remoteStream, remoteMedia, onEnd, onToggleMute, onToggleCamera, onDismiss, onCallAgain }: ActiveCallProps) {
  const [minimized, setMinimized] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const video = session.type === "VIDEO";
  const over = isTerminal(session.phase);
  const connected = session.phase === "CONNECTED";
  const showRemoteVideo = video && connected && !remoteMedia.cameraOff && hasLiveVideo(remoteStream);
  const showLocalVideo = video && !session.cameraOff && hasLiveVideo(localStream);
  const status = statusText(session);
  const name = fullName(session.peer);

  useEffect(() => {
    const sync = () => setFullscreen(document.fullscreenElement === panelRef.current && panelRef.current !== null);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  // A finished call always shows its outcome in full, and leaves fullscreen.
  useEffect(() => {
    if (!over) return;
    setMinimized(false);
    if (document.fullscreenElement) void document.exitFullscreen?.().catch(() => undefined);
  }, [over]);

  const toggleFullscreen = useCallback(() => {
    const panel = panelRef.current;
    if (!panel) return;
    if (document.fullscreenElement) void document.exitFullscreen?.().catch(() => undefined);
    else void panel.requestFullscreen?.().catch(() => undefined);
  }, []);

  const timer = connected && session.connectedAt ? <CallDuration since={session.connectedAt} className="tabular" /> : null;

  if (minimized && !over) {
    return (
      <div
        role="region"
        aria-label={`Call with ${name}`}
        className="fixed right-3 bottom-3 z-[70] flex items-center gap-3 rounded-2xl border border-line bg-panel p-2 pr-3 shadow-[var(--shadow-dialog)] sm:right-6 sm:bottom-6"
      >
        <StreamAudio stream={remoteStream} />
        {showRemoteVideo ? (
          <StreamVideo stream={remoteStream} muted className="h-14 w-24 rounded-lg bg-black object-cover" aria-label={`${name}'s video`} />
        ) : (
          <Avatar user={session.peer} size="md" />
        )}
        <div className="min-w-0">
          <p className="max-w-[9rem] truncate text-sm font-semibold text-ink">{name}</p>
          <p className="text-xs text-ink-mute" aria-live="polite">
            {timer ?? status}
          </p>
        </div>
        <button
          type="button"
          onClick={onToggleMute}
          aria-label={session.muted ? "Unmute microphone" : "Mute microphone"}
          aria-pressed={session.muted}
          className="flex size-9 items-center justify-center rounded-full bg-panel-3 text-ink hover:bg-line"
        >
          {session.muted ? <MicOff className="size-4" /> : <Mic className="size-4" />}
        </button>
        <button
          type="button"
          onClick={() => setMinimized(false)}
          aria-label="Expand call"
          className="flex size-9 items-center justify-center rounded-full bg-panel-3 text-ink hover:bg-line"
        >
          <Maximize2 className="size-4" />
        </button>
        <button type="button" onClick={onEnd} aria-label="End call" className="ml-1 flex size-9 items-center justify-center rounded-full bg-danger text-white hover:opacity-90">
          <PhoneOff className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm sm:p-6">
      <StreamAudio stream={remoteStream} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="false"
        aria-label={`${video ? "Video" : "Voice"} call with ${name}`}
        className={cn(
          "relative flex h-full w-full flex-col overflow-hidden bg-[#0b0d12] text-white sm:rounded-2xl sm:border sm:border-white/10 sm:shadow-2xl",
          video ? "sm:h-[min(82dvh,760px)] sm:max-w-5xl" : "sm:h-auto sm:min-h-[26rem] sm:max-w-sm",
          fullscreen && "sm:h-full sm:max-w-none sm:rounded-none",
        )}
      >
        {/* Stage: the other person's video, or their avatar while there's no picture. */}
        <div className="relative min-h-0 flex-1">
          {showRemoteVideo ? (
            <StreamVideo stream={remoteStream} muted className="absolute inset-0 size-full bg-black object-contain" aria-label={`${name}'s video`} />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 pb-4 text-center">
              <span className="relative">
                {!over && !connected && <span className="absolute inset-0 rounded-full bg-white/15 motion-safe:animate-ping" aria-hidden="true" />}
                <Avatar user={session.peer} size="xl" className="relative bg-white/10 text-white" />
              </span>
              <div>
                <p className="text-xl font-semibold">{name}</p>
                <p className="mt-1 text-sm text-white/70" aria-live="polite" role="status">
                  {connected && !session.reconnecting ? (video && remoteMedia.cameraOff ? "Camera is off" : timer) : status}
                </p>
                {connected && remoteMedia.muted && (
                  <p className="mt-2 inline-flex items-center gap-1 text-xs text-white/60">
                    <MicOff className="size-3.5" aria-hidden="true" /> {session.peer.firstName} is muted
                  </p>
                )}
                {over && session.durationSeconds ? <p className="mt-1 text-sm text-white/60">{formatCallDuration(session.durationSeconds)}</p> : null}
              </div>
            </div>
          )}

          {/* Top bar over the video: who, and how long / what's happening. */}
          {showRemoteVideo && (
            <div className="absolute inset-x-0 top-0 flex items-center gap-3 bg-gradient-to-b from-black/70 to-transparent p-4 pr-36 sm:pr-56">
              <div className="min-w-0">
                <p className="truncate font-semibold">{name}</p>
                <p className="text-sm text-white/75" role="status" aria-live="polite">
                  {session.reconnecting ? status : timer}
                  {remoteMedia.muted && <span className="ml-2 inline-flex items-center gap-1"><MicOff className="size-3.5" aria-hidden="true" /> muted</span>}
                </p>
              </div>
            </div>
          )}

          {session.reconnecting && (
            <p className="absolute top-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-amber/90 px-3 py-1 text-sm font-medium text-black" role="status">
              <WifiOff className="size-4" aria-hidden="true" /> Reconnecting…
            </p>
          )}

          {/* This device's camera: small, mirrored, out of the way of faces and controls. */}
          {video && !over && (
            <div className="absolute top-3 right-3 aspect-[3/4] w-24 overflow-hidden rounded-xl border border-white/20 bg-black shadow-lg sm:top-4 sm:right-4 sm:aspect-video sm:w-48">
              {showLocalVideo ? (
                <StreamVideo stream={localStream} muted className="size-full scale-x-[-1] object-cover" aria-label="Your camera" />
              ) : (
                <div className="flex size-full flex-col items-center justify-center gap-1 text-xs text-white/60">
                  <VideoOff className="size-5" aria-hidden="true" />
                  {session.cameraUnavailable ? "No camera" : "Camera off"}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Controls. End sits apart from the rest. */}
        <div className="flex shrink-0 items-center justify-center gap-3 bg-gradient-to-t from-black/70 to-transparent px-4 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:gap-4">
          {over ? (
            <>
              {(session.phase === "MISSED" || session.phase === "FAILED" || session.phase === "REJECTED") && session.direction === "outgoing" && (
                <button
                  type="button"
                  onClick={onCallAgain}
                  className="flex h-11 items-center gap-2 rounded-full bg-lime px-5 font-medium text-white hover:opacity-90 [:root[data-theme=dark]_&]:text-void"
                >
                  {session.type === "VIDEO" ? <Video className="size-4" /> : <RotateCcw className="size-4" />}
                  Call again
                </button>
              )}
              <button type="button" onClick={onDismiss} className="flex h-11 items-center gap-2 rounded-full bg-white/15 px-5 font-medium hover:bg-white/25">
                <X className="size-4" aria-hidden="true" /> Close
              </button>
            </>
          ) : (
            <>
              <ControlButton label={session.muted ? "Unmute microphone" : "Mute microphone"} pressed={session.muted} onClick={onToggleMute}>
                {session.muted ? <MicOff className="size-5" /> : <Mic className="size-5" />}
              </ControlButton>
              {video && (
                <ControlButton
                  label={session.cameraUnavailable ? "Camera unavailable" : session.cameraOff ? "Turn camera on" : "Turn camera off"}
                  pressed={session.cameraOff}
                  disabled={session.cameraUnavailable}
                  onClick={onToggleCamera}
                >
                  {session.cameraOff ? <VideoOff className="size-5" /> : <Video className="size-5" />}
                </ControlButton>
              )}
              {video && (
                <span className="hidden sm:contents">
                  <ControlButton label={fullscreen ? "Exit full screen" : "Full screen"} onClick={toggleFullscreen}>
                    {fullscreen ? <Minimize className="size-5" /> : <Maximize className="size-5" />}
                  </ControlButton>
                </span>
              )}
              <ControlButton label="Minimize call" onClick={() => setMinimized(true)}>
                <Minimize2 className="size-5" />
              </ControlButton>
              <span className="w-2 sm:w-6" aria-hidden="true" />
              <ControlButton label={session.phase === "RINGING" || session.phase === "OUTGOING" ? "Cancel call" : "End call"} danger onClick={onEnd}>
                <PhoneOff className="size-5" />
              </ControlButton>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
