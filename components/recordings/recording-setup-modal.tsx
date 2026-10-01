"use client";

import { Circle, Info, Mic, Square, Video, Volume2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { StreamVideo } from "@/components/calls/stream-media";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { useMediaDevices } from "@/hooks/use-media-devices";
import { usePreviewStream } from "@/hooks/use-preview-stream";
import type { RecorderSettings } from "@/hooks/use-screen-recorder";
import { webcamRect, type WebcamPosition, type WebcamShape, type WebcamSize } from "@/lib/recording/compositor";
import { detectSupport, MODE_ORDER, RECORDING_MODES, unsupportedReason, type BrowserSupport } from "@/lib/recording/media-support";
import { cn } from "@/lib/utils";
import type { RecordingType } from "@/types/recording";
import { RECORDING_TYPE_ICON, SwitchRow } from "./recording-meta";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: RecorderSettings;
  onStart: (settings: RecorderSettings) => void;
};

const SIZES: { value: WebcamSize; label: string }[] = [
  { value: "sm", label: "S" },
  { value: "md", label: "M" },
  { value: "lg", label: "L" },
];
const CORNERS: { value: WebcamPosition; label: string }[] = [
  { value: "top-left", label: "Top left" },
  { value: "top-right", label: "Top right" },
  { value: "bottom-left", label: "Bottom left" },
  { value: "bottom-right", label: "Bottom right" },
];

function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string; icon?: React.ReactNode }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs font-medium text-ink-dim">{label}</span>
      <div role="radiogroup" aria-label={label} className="flex rounded-lg border border-line bg-panel-2 p-0.5">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            aria-label={o.icon ? o.label : undefined}
            title={o.label}
            onClick={() => onChange(o.value)}
            className={cn(
              "flex h-7 min-w-8 cursor-pointer items-center justify-center rounded-md px-2 text-xs font-medium transition-colors",
              value === o.value ? "bg-panel text-ink shadow-sm" : "text-ink-mute hover:text-ink",
            )}
          >
            {o.icon ?? o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Where the camera bubble will sit, drawn over a stand-in for the screen. */
function LayoutPreview({ settings, stream, onChange }: { settings: RecorderSettings; stream: MediaStream | null; onChange: (webcam: RecorderSettings["webcam"]) => void }) {
  const { x, y, size } = webcamRect(settings.webcam, 160, 90);
  return (
    <div className="relative aspect-video overflow-hidden rounded-xl border border-line bg-[linear-gradient(135deg,var(--color-panel-3),var(--color-panel-2))]">
      <div className="absolute inset-x-[8%] top-[10%] space-y-[4%] opacity-60" aria-hidden="true">
        <div className="h-2 w-1/3 rounded bg-line-bright" />
        <div className="h-2 w-2/3 rounded bg-line" />
        <div className="h-2 w-1/2 rounded bg-line" />
      </div>
      {CORNERS.map((c) => (
        <button
          key={c.value}
          type="button"
          onClick={() => onChange({ ...settings.webcam, position: c.value })}
          aria-label={`Put camera ${c.label.toLowerCase()}`}
          aria-pressed={settings.webcam.position === c.value}
          className={cn("absolute size-1/2 cursor-pointer transition-colors hover:bg-cyan/5", c.value.startsWith("top") ? "top-0" : "bottom-0", c.value.endsWith("left") ? "left-0" : "right-0")}
        />
      ))}
      <div
        className={cn("pointer-events-none absolute overflow-hidden border-2 border-white bg-ink/80 shadow-lg transition-all duration-200", settings.webcam.shape === "circle" ? "rounded-full" : "rounded-[14%]")}
        style={{ left: `${(x / 160) * 100}%`, top: `${(y / 90) * 100}%`, width: `${(size / 160) * 100}%`, height: `${(size / 90) * 100}%` }}
      >
        {stream?.getVideoTracks().length ? <StreamVideo stream={stream} muted className="size-full -scale-x-100 object-cover" /> : <Video className="m-auto mt-[30%] size-1/3 text-white/70" />}
      </div>
    </div>
  );
}

export function RecordingSetupModal({ open, onOpenChange, initial, onStart }: Props) {
  const [settings, setSettings] = useState<RecorderSettings>(initial);
  const [support, setSupport] = useState<BrowserSupport | null>(null);
  const devices = useMediaDevices(open);

  useEffect(() => {
    if (!open) return;
    setSettings(initial);
    setSupport(detectSupport());
  }, [open, initial]);

  const mode = RECORDING_MODES[settings.mode];
  const preview = usePreviewStream({
    enabled: open,
    camera: mode.camera ? settings.cameraId : false,
    microphone: settings.microphone ? settings.microphoneId : false,
    // Once access is granted, the device list gains real names.
    onGranted: () => void devices.refresh(),
  });

  const update = (patch: Partial<RecorderSettings>) => setSettings((s) => ({ ...s, ...patch }));

  const selectMode = (next: RecordingType) => update({ mode: next });

  /** The camera switch moves between Full Screen and Full Screen + Webcam. */
  const setCamera = (on: boolean) => {
    if (settings.mode === "WEBCAM") return;
    update({ mode: on ? "SCREEN_WEBCAM" : "FULL_SCREEN" });
  };

  const cameras = devices.cameras.filter((d) => d.deviceId);
  const microphones = devices.microphones.filter((d) => d.deviceId);
  const noCamera = devices.loaded && devices.cameras.length === 0;
  const noMicrophone = devices.loaded && devices.microphones.length === 0;

  const blocker = useMemo(() => {
    if (!support) return null;
    const reason = unsupportedReason(settings.mode, support);
    if (reason) return reason;
    if (mode.camera && noCamera) return "No camera was found. Connect one, or choose a screen-only mode.";
    if (mode.camera && preview.problem.camera) return preview.problem.camera;
    if (settings.microphone && preview.problem.microphone) return `${preview.problem.microphone} Or turn the microphone off to record without sound.`;
    return null;
  }, [support, settings.mode, settings.microphone, mode.camera, noCamera, preview.problem]);

  const systemAudioNote = !support || !mode.screen ? "Only for screen recordings" : support.systemAudio ? "Sound playing on your computer" : "Not available on this browser / system";

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="New recording"
      description="Your entire screen is recorded, so you can switch between tabs and apps freely. Nothing is uploaded until you review the recording and save it."
      className="max-h-[calc(100dvh-2rem)] max-w-3xl overflow-y-auto"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => onStart(settings)} disabled={!support || Boolean(blocker)} icon={<span className="size-2.5 rounded-full bg-current" aria-hidden="true" />}>
            Start recording
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <fieldset>
          <legend className="mb-2.5 text-sm font-medium text-ink">What do you want to record?</legend>
          <div role="radiogroup" aria-label="Recording mode" className="grid gap-2.5 sm:grid-cols-3">
            {MODE_ORDER.map((type) => {
              const info = RECORDING_MODES[type];
              const Icon = RECORDING_TYPE_ICON[type];
              const reason = support ? unsupportedReason(type, support) : null;
              const selected = settings.mode === type;
              return (
                <button
                  key={type}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={Boolean(reason)}
                  title={reason ?? info.description}
                  onClick={() => selectMode(type)}
                  className={cn(
                    "flex cursor-pointer flex-col items-start gap-2 rounded-xl border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-45",
                    selected ? "border-cyan bg-cyan/[0.06] ring-2 ring-cyan/20" : "border-line bg-panel hover:border-line-bright hover:bg-panel-2",
                  )}
                >
                  <span className={cn("flex size-8 items-center justify-center rounded-lg", selected ? "bg-cyan text-white [:root[data-theme=dark]_&]:text-void" : "bg-panel-3 text-ink-dim")}>
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block text-sm font-medium text-ink">{info.label}</span>
                    <span className="block text-xs leading-snug text-ink-mute">{info.description}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="grid gap-6 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <div className="space-y-3">
            {settings.mode === "SCREEN_WEBCAM" ? (
              <>
                <LayoutPreview settings={settings} stream={preview.stream} onChange={(webcam) => update({ webcam })} />
                <Segmented<WebcamShape>
                  label="Camera shape"
                  value={settings.webcam.shape}
                  onChange={(shape) => update({ webcam: { ...settings.webcam, shape } })}
                  options={[
                    { value: "circle", label: "Circle", icon: <Circle className="size-3.5" /> },
                    { value: "rounded", label: "Square", icon: <Square className="size-3.5" /> },
                  ]}
                />
                <Segmented<WebcamSize> label="Camera size" value={settings.webcam.size} onChange={(size) => update({ webcam: { ...settings.webcam, size } })} options={SIZES} />
                <p className="text-xs text-ink-mute">Click a corner of the preview to move the camera. You can also drag it while recording.</p>
              </>
            ) : settings.mode === "WEBCAM" ? (
              <div className="relative aspect-video overflow-hidden rounded-xl border border-line bg-ink/90">
                {preview.stream?.getVideoTracks().length ? (
                  <StreamVideo stream={preview.stream} muted className="size-full -scale-x-100 object-cover" />
                ) : (
                  <div className="flex size-full flex-col items-center justify-center gap-2 text-white/70">
                    <Video className="size-8" aria-hidden="true" />
                    <span className="text-xs">{preview.problem.camera ? "Camera unavailable" : "Starting camera…"}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex aspect-video flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-line-bright bg-panel-2 px-6 text-center">
                <span className="flex size-11 items-center justify-center rounded-full bg-cyan/10 text-cyan">
                  {(() => {
                    const Icon = RECORDING_TYPE_ICON[settings.mode];
                    return <Icon className="size-5" aria-hidden="true" />;
                  })()}
                </span>
                <p className="text-sm text-ink-dim">
                  After you press <span className="font-medium text-ink">Start recording</span>, your browser asks what to share — choose{" "}
                  <span className="font-medium text-ink">Entire Screen</span>. Recording continues as you move between tabs and apps, until you press Stop.
                </p>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <SwitchRow
              id="rec-camera"
              icon={Video}
              label="Camera"
              description={settings.mode === "WEBCAM" ? "Needed for camera-only recordings" : noCamera ? "No camera found" : "Show yourself in a bubble"}
              checked={mode.camera}
              disabled={settings.mode === "WEBCAM" || (noCamera && !mode.camera) || (support ? Boolean(unsupportedReason("SCREEN_WEBCAM", support)) && !mode.camera : true)}
              onCheckedChange={setCamera}
            />
            {mode.camera && cameras.length > 0 && (
              <Select
                aria-label="Camera"
                value={settings.cameraId && cameras.some((c) => c.deviceId === settings.cameraId) ? settings.cameraId : undefined}
                onValueChange={(cameraId) => update({ cameraId: cameraId ?? null })}
                placeholder="Default camera"
                options={cameras.map((c) => ({ value: c.deviceId, label: c.label }))}
              />
            )}

            <SwitchRow
              id="rec-microphone"
              icon={Mic}
              label="Microphone"
              description={noMicrophone ? "No microphone found" : settings.microphone ? "Your voice is recorded" : "Record without your voice"}
              checked={settings.microphone && !noMicrophone}
              disabled={noMicrophone}
              onCheckedChange={(microphone) => update({ microphone })}
            />
            {settings.microphone && !noMicrophone && (
              <div className="space-y-2">
                {microphones.length > 0 && (
                  <Select
                    aria-label="Microphone"
                    value={settings.microphoneId && microphones.some((m) => m.deviceId === settings.microphoneId) ? settings.microphoneId : undefined}
                    onValueChange={(microphoneId) => update({ microphoneId: microphoneId ?? null })}
                    placeholder="Default microphone"
                    options={microphones.map((m) => ({ value: m.deviceId, label: m.label }))}
                  />
                )}
                <div className="flex items-center gap-2" aria-hidden="true">
                  <Mic className="size-3.5 text-ink-mute" />
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-panel-3">
                    <div className="h-full rounded-full bg-lime transition-[width] duration-75" style={{ width: `${Math.round(preview.level * 100)}%` }} />
                  </div>
                </div>
              </div>
            )}

            <SwitchRow
              id="rec-system-audio"
              icon={Volume2}
              label="System audio"
              description={systemAudioNote}
              checked={settings.systemAudio && mode.screen && Boolean(support?.systemAudio)}
              disabled={!mode.screen || !support?.systemAudio}
              onCheckedChange={(systemAudio) => update({ systemAudio })}
            />

            {devices.loaded && !devices.named && (mode.camera || settings.microphone) && !preview.stream && !preview.problem.camera && !preview.problem.microphone && (
              <p className="text-xs text-ink-mute">Allow camera and microphone access when your browser asks, to choose devices.</p>
            )}
          </div>
        </div>

        {blocker && (
          <div role="alert" className="flex items-start gap-2.5 rounded-lg border border-amber/30 bg-amber/10 px-3.5 py-3 text-sm text-ink">
            <Info className="mt-0.5 size-4 shrink-0 text-amber" aria-hidden="true" />
            <p>{blocker}</p>
          </div>
        )}
      </div>
    </Dialog>
  );
}
