"use client";

import { AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog } from "@/components/ui/dialog";
import { useSaveRecording } from "@/hooks/use-recordings";
import { useScreenRecorder, type RecorderSettings } from "@/hooks/use-screen-recorder";
import { describeError } from "@/lib/api/errors";
import { DEFAULT_WEBCAM_LAYOUT } from "@/lib/recording/compositor";
import { hasUnsavedRecording, isErrorState, type RecorderErrorStatus } from "@/lib/recording/recording-state";
import { captureThumbnail } from "@/lib/recording/thumbnail";
import { StorageUploadError } from "@/services/recordings.service";
import { RecordingPreview, type RecordingDetails } from "./recording-preview";
import { RecordingSetupModal } from "./recording-setup-modal";
import { RecordingCountdown, RecordingToolbar } from "./recording-toolbar";
import { WebcamOverlay } from "./webcam-overlay";

type RecorderContextValue = {
  /** False outside the signed-in app (and in isolated component tests). */
  available: boolean;
  /** A recording is being set up, made, reviewed or saved. */
  busy: boolean;
  openRecorder: () => void;
};

const RecorderContext = createContext<RecorderContextValue>({ available: false, busy: false, openRecorder: () => undefined });

export const useRecorder = () => useContext(RecorderContext);

const SETTINGS_KEY = "tf.recorder.settings";

const DEFAULT_SETTINGS: RecorderSettings = {
  mode: "FULL_SCREEN",
  microphone: true,
  systemAudio: true,
  cameraId: null,
  microphoneId: null,
  webcam: DEFAULT_WEBCAM_LAYOUT,
};

function readSettings(): RecorderSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const saved = JSON.parse(raw) as Partial<RecorderSettings>;
    return { ...DEFAULT_SETTINGS, ...saved, webcam: { ...DEFAULT_WEBCAM_LAYOUT, ...saved.webcam } };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function storeSettings(settings: RecorderSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* storage unavailable — settings just aren't remembered */
  }
}

const ERROR_TITLE: Record<RecorderErrorStatus, string> = {
  PERMISSION_DENIED: "Permission needed",
  CAMERA_ERROR: "Camera problem",
  MICROPHONE_ERROR: "Microphone problem",
  SCREEN_CAPTURE_ERROR: "Screen capture failed",
  BROWSER_NOT_SUPPORTED: "Not supported in this browser",
  RECORDING_FAILED: "Recording failed",
  UPLOAD_FAILED: "Upload failed",
};

/**
 * Screen / webcam recording for the whole signed-in app. Lives in the app
 * shell so a recording keeps going — and its controls stay on screen — while
 * the user moves between TimeFlow pages (often the very thing being recorded).
 */
export function RecorderProvider({ children }: { children: ReactNode }) {
  const recorder = useScreenRecorder();
  const save = useSaveRecording();
  const router = useRouter();
  const [setupOpen, setSetupOpen] = useState(false);
  const [settings, setSettings] = useState<RecorderSettings>(DEFAULT_SETTINGS);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const { status, notice, dismissNotice } = recorder;

  const showSetup = useCallback(() => {
    setSettings(readSettings());
    setSetupOpen(true);
  }, []);

  const openRecorder = useCallback(() => {
    if (status !== "IDLE") {
      toast.info("Finish the current recording first", { description: "Stop it, or save or discard the one you're reviewing." });
      return;
    }
    showSetup();
  }, [status, showSetup]);

  const start = (next: RecorderSettings) => {
    storeSettings(next);
    setSettings(next);
    setSetupOpen(false);
    // Synchronously within the click: the browser only opens its screen picker in response to one.
    void recorder.start(next);
  };

  // Notices (e.g. "tab audio wasn't shared") are worth knowing but don't stop the recording.
  useEffect(() => {
    if (!notice) return;
    toast.warning(notice, { id: "recorder-notice", duration: 8000 });
    dismissNotice();
  }, [notice, dismissNotice]);

  // Leaving or reloading the page would lose a recording in progress or awaiting review.
  const unsafeToLeave = recorder.capturing || hasUnsavedRecording(status) || status === "PROCESSING";
  useEffect(() => {
    if (!unsafeToLeave) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [unsafeToLeave]);

  const onSave = async (details: RecordingDetails) => {
    const video = recorder.getBlob();
    const result = recorder.result;
    if (!video || !result || !recorder.markUploading()) return;
    try {
      const thumbnail = await captureThumbnail(result.url);
      const saved = await save.mutateAsync({ video, thumbnail, details });
      recorder.markSaved();
      toast.success("Recording saved", {
        description: saved.title,
        action: { label: "View", onClick: () => router.push(`/recordings/${saved.id}`) },
      });
      // Releases the local Blob and its object URL.
      recorder.discard();
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        recorder.markUploadFailed("Upload cancelled.");
        recorder.backToPreview();
        return;
      }
      recorder.markUploadFailed(error instanceof StorageUploadError ? error.message : describeError(error).message);
    }
  };

  const value = useMemo<RecorderContextValue>(() => ({ available: true, busy: status !== "IDLE", openRecorder }), [status, openRecorder]);
  const recording = status === "RECORDING" || status === "PAUSED";
  const reviewing = status === "PROCESSING" || status === "PREVIEW" || status === "UPLOADING" || status === "UPLOAD_FAILED" || status === "SAVED";
  const captureError = isErrorState(status) && status !== "UPLOAD_FAILED";

  return (
    <RecorderContext.Provider value={value}>
      {children}

      <RecordingSetupModal open={setupOpen} onOpenChange={setSetupOpen} initial={settings} onStart={start} />

      {status === "COUNTDOWN" && recorder.countdown !== null && <RecordingCountdown value={recorder.countdown} onCancel={recorder.discard} />}

      {(recording || status === "COUNTDOWN") && recorder.cameraStream && (
        <WebcamOverlay
          stream={recorder.cameraStream}
          layout={recorder.webcamLayout}
          onLayoutChange={recorder.setWebcamLayout}
          cameraOn={recorder.cameraOn}
          cameraOnly={recorder.recordingType === "WEBCAM"}
          defaultMinimized={recorder.captureSurface === "browser"}
        />
      )}

      {recording && (
        <RecordingToolbar
          paused={status === "PAUSED"}
          elapsedMs={recorder.elapsedMs}
          micOn={recorder.micOn}
          hasMicrophone={recorder.hasMicrophone}
          cameraOn={recorder.cameraOn}
          hasCamera={Boolean(recorder.cameraStream)}
          onPause={recorder.pause}
          onResume={recorder.resume}
          onToggleMic={recorder.toggleMic}
          onToggleCamera={recorder.toggleCamera}
          onStop={recorder.stop}
          onDiscard={() => setConfirmDiscard(true)}
        />
      )}

      {reviewing && (
        <RecordingPreview
          // A fresh form for every recording.
          key={recorder.result?.url ?? "processing"}
          status={status}
          result={recorder.result}
          error={recorder.error}
          progress={save.progress}
          onSave={(details) => void onSave(details)}
          onDiscard={recorder.discard}
          onCancelUpload={save.cancel}
        />
      )}

      {captureError && (
        <Dialog
          open
          onOpenChange={(open) => !open && recorder.discard()}
          title={ERROR_TITLE[status]}
          tone="danger"
          footer={
            <>
              <Button variant="secondary" onClick={recorder.discard}>
                Close
              </Button>
              <Button
                onClick={() => {
                  recorder.discard();
                  showSetup();
                }}
              >
                Back to setup
              </Button>
            </>
          }
        >
          <div className="flex items-start gap-3 text-sm text-ink-dim">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-danger" aria-hidden="true" />
            <p>{recorder.error}</p>
          </div>
        </Dialog>
      )}

      <ConfirmDialog
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        title="Discard this recording?"
        description="Recording stops and nothing is kept."
        confirmLabel="Discard"
        onConfirm={() => {
          setConfirmDiscard(false);
          recorder.discard();
        }}
      />
    </RecorderContext.Provider>
  );
}
