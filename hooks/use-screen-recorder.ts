"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AudioMixer, needsMixing } from "@/lib/recording/audio-mixer";
import { Compositor, DEFAULT_WEBCAM_LAYOUT, type WebcamLayout } from "@/lib/recording/compositor";
import { containerOf, detectSupport, explainCaptureError, pickMimeType, RECORDING_MODES, RecorderError, unsupportedReason } from "@/lib/recording/media-support";
import { isCapturing, isErrorState, transition, type RecorderErrorStatus, type RecorderEvent, type RecorderState } from "@/lib/recording/recording-state";
import type { RecordingType } from "@/types/recording";

export type RecorderSettings = {
  mode: RecordingType;
  microphone: boolean;
  /** Ask the browser to include the shared tab's / system's sound. */
  systemAudio: boolean;
  cameraId: string | null;
  microphoneId: string | null;
  webcam: WebcamLayout;
};

/** The finished recording. The Blob itself stays in a ref (see `getBlob`), never in React state. */
export type RecordingResult = {
  url: string;
  size: number;
  mimeType: string;
  durationSeconds: number;
  recordingType: RecordingType;
};

export const COUNTDOWN_SECONDS = 3;
const TIMESLICE_MS = 1000;

type Streams = { screen: MediaStream | null; camera: MediaStream | null; microphone: MediaStream | null };
const NO_STREAMS: Streams = { screen: null, camera: null, microphone: null };

const stopStream = (stream: MediaStream | null) => stream?.getTracks().forEach((t) => t.stop());

/** Screen capture → the recording type it really was: the browser's picker can choose a different surface than the mode hinted. */
function typeForSurface(mode: RecordingType, surface: string | undefined): RecordingType {
  if (mode !== "FULL_SCREEN" && mode !== "WINDOW" && mode !== "BROWSER_TAB") return mode;
  if (surface === "monitor") return "FULL_SCREEN";
  if (surface === "window") return "WINDOW";
  if (surface === "browser") return "BROWSER_TAB";
  return mode;
}

/** About 0.07 bits per pixel per frame, kept between 1.5 and 6 Mbps. */
function videoBitrate(track: MediaStreamTrack | undefined) {
  const s = track?.getSettings() ?? {};
  const pixels = (s.width ?? 1280) * (s.height ?? 720);
  return Math.round(Math.min(6_000_000, Math.max(1_500_000, pixels * (s.frameRate ?? 30) * 0.07)));
}

/**
 * Records the screen, a window, a tab and/or the webcam entirely in the
 * browser. Nothing is uploaded here: stopping produces a local Blob and an
 * object URL for the preview, and saving is a separate, explicit step.
 */
export function useScreenRecorder() {
  const [status, setStatus] = useState<RecorderState>("IDLE");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [hasMicrophone, setHasMicrophone] = useState(false);
  const [captureSurface, setCaptureSurface] = useState<string | null>(null);
  const [recordingType, setRecordingType] = useState<RecordingType | null>(null);
  const [webcamLayout, setWebcamLayoutState] = useState<WebcamLayout>(DEFAULT_WEBCAM_LAYOUT);
  const [result, setResult] = useState<RecordingResult | null>(null);

  const statusRef = useRef<RecorderState>("IDLE");
  /** Bumped by every start and discard, so a stale async step can tell it was superseded. */
  const runRef = useRef(0);
  const streamsRef = useRef<Streams>(NO_STREAMS);
  const compositorRef = useRef<Compositor | null>(null);
  const mixerRef = useRef<AudioMixer | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const blobRef = useRef<Blob | null>(null);
  const urlRef = useRef<string | null>(null);
  const listenersRef = useRef<(() => void)[]>([]);
  const timersRef = useRef<{ countdown: ReturnType<typeof setTimeout> | null; elapsed: ReturnType<typeof setInterval> | null }>({ countdown: null, elapsed: null });
  const timingRef = useRef({ startedAt: 0, pausedAt: 0, pausedTotal: 0, durationMs: 0 });
  const micOnRef = useRef(true);
  const typeRef = useRef<RecordingType | null>(null);

  /** Applies an event through the state machine; the ref is updated synchronously for async callers. */
  const send = useCallback((event: RecorderEvent) => {
    const next = transition(statusRef.current, event);
    if (next === statusRef.current) return false;
    statusRef.current = next;
    setStatus(next);
    return true;
  }, []);

  const fail = useCallback(
    (status: RecorderErrorStatus, message: string) => {
      if (send({ type: "FAIL", error: status })) setError(message);
    },
    [send],
  );

  const elapsed = () => {
    const t = timingRef.current;
    if (!t.startedAt) return 0;
    const end = statusRef.current === "PAUSED" ? t.pausedAt : performance.now();
    return Math.max(0, end - t.startedAt - t.pausedTotal);
  };

  const clearTimers = () => {
    const timers = timersRef.current;
    if (timers.countdown) clearTimeout(timers.countdown);
    if (timers.elapsed) clearInterval(timers.elapsed);
    timers.countdown = null;
    timers.elapsed = null;
  };

  /** Stops every track and frees the canvas, audio graph and listeners. Safe to call repeatedly. */
  const releaseMedia = useCallback(() => {
    for (const off of listenersRef.current.splice(0)) off();
    compositorRef.current?.dispose();
    compositorRef.current = null;
    mixerRef.current?.dispose();
    mixerRef.current = null;
    const { screen, camera, microphone } = streamsRef.current;
    stopStream(screen);
    stopStream(camera);
    stopStream(microphone);
    streamsRef.current = NO_STREAMS;
    setCameraStream(null);
  }, []);

  const releaseResult = useCallback(() => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    blobRef.current = null;
    chunksRef.current = [];
    setResult(null);
  }, []);

  const finalize = useCallback(
    (recorder: MediaRecorder, requestedMime: string) => {
      if (statusRef.current !== "PROCESSING") return;
      const type = containerOf(recorder.mimeType || requestedMime);
      const blob = new Blob(chunksRef.current, { type });
      chunksRef.current = [];
      recorderRef.current = null;
      if (!blob.size) {
        fail("RECORDING_FAILED", "Nothing was recorded. Try again, and keep the recording going for at least a second.");
        return;
      }
      blobRef.current = blob;
      urlRef.current = URL.createObjectURL(blob);
      setResult({
        url: urlRef.current,
        size: blob.size,
        mimeType: type,
        durationSeconds: Math.max(1, Math.round(timingRef.current.durationMs / 1000)),
        recordingType: typeRef.current ?? "FULL_SCREEN",
      });
      send({ type: "PROCESSED" });
    },
    [fail, send],
  );

  const stop = useCallback(() => {
    const current = statusRef.current;
    if (current !== "RECORDING" && current !== "PAUSED") return;
    timingRef.current.durationMs = elapsed();
    send({ type: "STOP" });
    clearTimers();
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop(); // final dataavailable, then onstop → finalize
    releaseMedia();
  }, [releaseMedia, send]);

  const beginRecording = useCallback(
    (run: number, stream: MediaStream, mimeType: string) => {
      if (run !== runRef.current || statusRef.current !== "COUNTDOWN") return;
      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: videoBitrate(stream.getVideoTracks()[0]), audioBitsPerSecond: 128_000 });
      } catch {
        try {
          recorder = new MediaRecorder(stream);
        } catch {
          releaseMedia();
          fail("RECORDING_FAILED", "The recording couldn't start in this browser. Try again, or use the latest Chrome or Edge.");
          return;
        }
      }
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data);
      };
      recorder.onerror = () => {
        if (run !== runRef.current) return;
        clearTimers();
        recorderRef.current = null;
        chunksRef.current = [];
        releaseMedia();
        fail("RECORDING_FAILED", "The recording stopped unexpectedly. Please try again.");
      };
      recorder.onstop = () => {
        if (run !== runRef.current) return;
        // Stopped by the browser (every track ended) rather than by us: wrap up the same way.
        if (statusRef.current === "RECORDING" || statusRef.current === "PAUSED") {
          timingRef.current.durationMs = elapsed();
          send({ type: "STOP" });
          clearTimers();
          releaseMedia();
        }
        finalize(recorder, mimeType);
      };
      recorderRef.current = recorder;
      try {
        recorder.start(TIMESLICE_MS);
      } catch {
        recorderRef.current = null;
        releaseMedia();
        fail("RECORDING_FAILED", "The recording couldn't start. Please try again.");
        return;
      }
      timingRef.current = { startedAt: performance.now(), pausedAt: 0, pausedTotal: 0, durationMs: 0 };
      setElapsedMs(0);
      send({ type: "COUNTDOWN_DONE" });
      timersRef.current.elapsed = setInterval(() => setElapsedMs(elapsed()), 250);
    },
    [fail, finalize, releaseMedia, send],
  );

  const start = useCallback(
    async (settings: RecorderSettings) => {
      // Only from rest, or retrying after a capture error. An unsaved recording must be discarded first.
      const current = statusRef.current;
      if (current !== "IDLE" && (!isErrorState(current) || current === "UPLOAD_FAILED")) return;
      if (current !== "IDLE") send({ type: "RESET" });
      const run = ++runRef.current;
      setError(null);
      setNotice(null);
      setElapsedMs(0);
      send({ type: "REQUEST_PERMISSION" });

      const mode = RECORDING_MODES[settings.mode];
      const support = detectSupport();
      const reason = unsupportedReason(settings.mode, support);
      if (reason) return fail("BROWSER_NOT_SUPPORTED", reason);
      const mimeType = pickMimeType();
      if (!mimeType) return fail("BROWSER_NOT_SUPPORTED", "This browser can't record in a format TimeFlow can save (WebM or MP4). Use the latest Chrome, Edge, Firefox or Safari.");

      const streams: Streams = { screen: null, camera: null, microphone: null };
      const wantsSystemAudio = settings.systemAudio && mode.screen && support.systemAudio !== "none";
      try {
        // Screen first: the browser only opens its picker in direct response to the click.
        if (mode.screen) {
          try {
            streams.screen = await navigator.mediaDevices.getDisplayMedia({
              video: { displaySurface: mode.displaySurface, frameRate: { ideal: 30 } },
              audio: wantsSystemAudio,
              // Chromium-only hints; other browsers ignore unknown members.
              ...({ selfBrowserSurface: "include", surfaceSwitching: "include", systemAudio: wantsSystemAudio ? "include" : "exclude", monitorTypeSurfaces: "include" } as object),
            } as DisplayMediaStreamOptions);
          } catch (e) {
            throw explainCaptureError(e, "screen");
          }
          // 4K screens make very large files; 1080p is plenty for a walkthrough.
          await streams.screen
            .getVideoTracks()[0]
            ?.applyConstraints({ width: { max: 1920 }, height: { max: 1080 }, frameRate: { max: 30 } })
            .catch(() => undefined);
        }
        if (mode.camera) {
          try {
            streams.camera = await navigator.mediaDevices.getUserMedia({
              video: {
                ...(settings.cameraId ? { deviceId: { exact: settings.cameraId } } : { facingMode: "user" }),
                width: { ideal: mode.screen ? 640 : 1280 },
                height: { ideal: mode.screen ? 640 : 720 },
                frameRate: { ideal: 30 },
              },
            });
          } catch (e) {
            throw explainCaptureError(e, "camera");
          }
        }
        if (settings.microphone) {
          try {
            streams.microphone = await navigator.mediaDevices.getUserMedia({
              audio: { ...(settings.microphoneId ? { deviceId: { exact: settings.microphoneId } } : {}), echoCancellation: true, noiseSuppression: true, autoGainControl: true },
            });
          } catch (e) {
            throw explainCaptureError(e, "microphone");
          }
        }
      } catch (e) {
        Object.values(streams).forEach(stopStream);
        if (run !== runRef.current) return;
        const problem = e instanceof RecorderError ? e : new RecorderError("RECORDING_FAILED", "Recording couldn't start. Please try again.");
        return fail(problem.status, problem.message);
      }
      // Cancelled while the browser's dialogs were open.
      if (run !== runRef.current || statusRef.current !== "REQUESTING_PERMISSION") {
        Object.values(streams).forEach(stopStream);
        return;
      }

      streamsRef.current = streams;
      const screenTrack = streams.screen?.getVideoTracks()[0];
      const surface = (screenTrack?.getSettings() as { displaySurface?: string } | undefined)?.displaySurface;
      const type = typeForSurface(settings.mode, surface);
      typeRef.current = type;
      setRecordingType(type);
      setCaptureSurface(surface ?? null);
      if (wantsSystemAudio && !streams.screen?.getAudioTracks().length) {
        setNotice(
          surface === "browser"
            ? "Tab audio wasn't shared, so only your microphone is recorded. Next time, tick “Also share tab audio” in the browser's dialog."
            : "System audio isn't available for this choice, so only your microphone is recorded. Share a browser tab to capture its sound.",
        );
      } else if (settings.systemAudio && mode.screen && support.systemAudio === "none") {
        setNotice("This browser can't record system or tab audio; your microphone is still recorded.");
      }

      // ── Build the stream that gets recorded ──
      let videoTrack: MediaStreamTrack | undefined;
      try {
        if (streams.screen && streams.camera) {
          const compositor = new Compositor(streams.screen, streams.camera, settings.webcam);
          compositor.start();
          compositorRef.current = compositor;
          videoTrack = compositor.stream.getVideoTracks()[0];
        } else {
          videoTrack = (streams.screen ?? streams.camera)?.getVideoTracks()[0];
        }
      } catch {
        releaseMedia();
        return fail("RECORDING_FAILED", "Your screen and camera couldn't be combined in this browser. Record them separately instead.");
      }
      let audioTrack: MediaStreamTrack | null = null;
      if (needsMixing(streams.microphone, streams.screen) && support.webAudio) {
        mixerRef.current = new AudioMixer({ microphone: streams.microphone, system: streams.screen });
        audioTrack = mixerRef.current.track;
      } else {
        audioTrack = streams.microphone?.getAudioTracks()[0] ?? streams.screen?.getAudioTracks()[0] ?? null;
      }
      const recordStream = new MediaStream([videoTrack, audioTrack].filter((t): t is MediaStreamTrack => !!t));

      micOnRef.current = Boolean(streams.microphone);
      setMicOn(Boolean(streams.microphone));
      setHasMicrophone(Boolean(streams.microphone));
      setCameraOn(Boolean(streams.camera));
      setWebcamLayoutState(settings.webcam);
      setCameraStream(streams.camera);

      // The browser's own "Stop sharing" button ends the recording, like our Stop.
      if (screenTrack) {
        const onEnded = () => stop();
        screenTrack.addEventListener("ended", onEnded);
        listenersRef.current.push(() => screenTrack.removeEventListener("ended", onEnded));
      }
      const cameraTrack = streams.camera?.getVideoTracks()[0];
      if (cameraTrack) {
        const onEnded = () => {
          if (!streams.screen) return stop();
          compositorRef.current?.setCameraVisible(false);
          setCameraOn(false);
          setCameraStream(null);
          setNotice("Your camera disconnected. The recording continues with just your screen.");
        };
        cameraTrack.addEventListener("ended", onEnded);
        listenersRef.current.push(() => cameraTrack.removeEventListener("ended", onEnded));
      }

      send({ type: "PERMISSION_GRANTED" });
      send({ type: "START_COUNTDOWN" });
      let remaining = COUNTDOWN_SECONDS;
      setCountdown(remaining);
      const tick = () => {
        if (run !== runRef.current || statusRef.current !== "COUNTDOWN") return;
        remaining -= 1;
        if (remaining > 0) {
          setCountdown(remaining);
          timersRef.current.countdown = setTimeout(tick, 1000);
        } else {
          setCountdown(null);
          beginRecording(run, recordStream, mimeType);
        }
      };
      timersRef.current.countdown = setTimeout(tick, 1000);
    },
    [beginRecording, fail, releaseMedia, send, stop],
  );

  const pause = useCallback(() => {
    const recorder = recorderRef.current;
    if (statusRef.current !== "RECORDING" || !recorder || recorder.state !== "recording") return;
    recorder.pause();
    timingRef.current.pausedAt = performance.now();
    send({ type: "PAUSE" });
    setElapsedMs(elapsed());
  }, [send]);

  const resume = useCallback(() => {
    const recorder = recorderRef.current;
    if (statusRef.current !== "PAUSED" || !recorder || recorder.state !== "paused") return;
    recorder.resume();
    timingRef.current.pausedTotal += performance.now() - timingRef.current.pausedAt;
    send({ type: "RESUME" });
  }, [send]);

  const toggleMic = useCallback(() => {
    const mic = streamsRef.current.microphone;
    if (!mic) return;
    const next = !micOnRef.current;
    micOnRef.current = next;
    if (mixerRef.current) mixerRef.current.setMicrophoneEnabled(next);
    for (const track of mic.getAudioTracks()) track.enabled = next;
    setMicOn(next);
  }, []);

  const toggleCamera = useCallback(() => {
    const camera = streamsRef.current.camera;
    if (!camera) return;
    setCameraOn((on) => {
      const next = !on;
      compositorRef.current?.setCameraVisible(next);
      for (const track of camera.getVideoTracks()) track.enabled = next;
      return next;
    });
  }, []);

  const setWebcamLayout = useCallback((layout: WebcamLayout) => {
    compositorRef.current?.setLayout(layout);
    setWebcamLayoutState(layout);
  }, []);

  /** Throws away everything — live media, the recording, the preview — and returns to IDLE. */
  const discard = useCallback(() => {
    runRef.current += 1;
    clearTimers();
    const recorder = recorderRef.current;
    recorderRef.current = null;
    if (recorder) {
      recorder.ondataavailable = null;
      recorder.onstop = null;
      recorder.onerror = null;
      if (recorder.state !== "inactive") {
        try {
          recorder.stop();
        } catch {
          /* already stopping */
        }
      }
    }
    releaseMedia();
    releaseResult();
    timingRef.current = { startedAt: 0, pausedAt: 0, pausedTotal: 0, durationMs: 0 };
    typeRef.current = null;
    setCountdown(null);
    setElapsedMs(0);
    setError(null);
    setNotice(null);
    setRecordingType(null);
    setCaptureSurface(null);
    send({ type: "RESET" });
  }, [releaseMedia, releaseResult, send]);

  /** Upload lifecycle, driven by whoever saves the recording. */
  const markUploading = useCallback(() => {
    setError(null);
    return send({ type: "UPLOAD" });
  }, [send]);
  const markSaved = useCallback(() => send({ type: "UPLOADED" }), [send]);
  const markUploadFailed = useCallback((message: string) => fail("UPLOAD_FAILED", message), [fail]);
  const backToPreview = useCallback(() => send({ type: "BACK_TO_PREVIEW" }), [send]);

  const getBlob = useCallback(() => blobRef.current, []);

  // Leaving the app mid-recording must not leave the camera light or screen share on.
  useEffect(
    () => () => {
      runRef.current += 1;
      clearTimers();
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.onstop = null;
        recorder.stop();
      }
      releaseMedia();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
      blobRef.current = null;
      chunksRef.current = [];
    },
    [releaseMedia],
  );

  return {
    status,
    error,
    notice,
    dismissNotice: useCallback(() => setNotice(null), []),
    countdown,
    elapsedMs,
    micOn,
    cameraOn,
    hasMicrophone,
    cameraStream,
    captureSurface,
    recordingType,
    webcamLayout,
    result,
    capturing: isCapturing(status),
    start,
    pause,
    resume,
    stop,
    toggleMic,
    toggleCamera,
    setWebcamLayout,
    discard,
    markUploading,
    markSaved,
    markUploadFailed,
    backToPreview,
    getBlob,
  };
}

export type ScreenRecorder = ReturnType<typeof useScreenRecorder>;
