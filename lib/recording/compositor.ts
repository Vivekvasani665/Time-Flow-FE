/**
 * Draws the shared screen plus a webcam bubble into a canvas, and exposes the
 * canvas as the video stream that gets recorded (canvas.captureStream).
 *
 * Frames are driven by a timer inside a Web Worker. While recording, the user
 * is usually looking at another window, which makes this tab a background tab:
 * there requestAnimationFrame stops entirely and main-thread timers are
 * throttled to about once a second — the recording would freeze. Worker timers
 * keep their rate, and their messages still wake the main thread.
 */

export type WebcamPosition = "top-left" | "top-right" | "bottom-left" | "bottom-right";
export type WebcamSize = "sm" | "md" | "lg";
export type WebcamShape = "circle" | "rounded";
export type WebcamLayout = { position: WebcamPosition; size: WebcamSize; shape: WebcamShape };

export const DEFAULT_WEBCAM_LAYOUT: WebcamLayout = { position: "bottom-left", size: "md", shape: "circle" };

/** Bubble diameter as a share of the frame height. */
export const WEBCAM_SIZE_RATIO: Record<WebcamSize, number> = { sm: 0.18, md: 0.26, lg: 0.36 };

const MAX_WIDTH = 1920;
const MARGIN_RATIO = 0.03;

const WORKER_SOURCE = `let t=null;onmessage=(e)=>{clearInterval(t);t=null;if(e.data>0)t=setInterval(()=>postMessage(0),e.data);};`;

/** Ticks at `intervalMs`, from a worker when possible. Returns a stop function that releases everything. */
export function startTicker(intervalMs: number, onTick: () => void): () => void {
  if (typeof Worker !== "undefined" && typeof URL.createObjectURL === "function") {
    try {
      const url = URL.createObjectURL(new Blob([WORKER_SOURCE], { type: "text/javascript" }));
      const worker = new Worker(url);
      worker.onmessage = onTick;
      worker.postMessage(intervalMs);
      return () => {
        worker.postMessage(0);
        worker.terminate();
        URL.revokeObjectURL(url);
      };
    } catch {
      /* CSP or sandboxing blocked the worker: fall back to a main-thread timer */
    }
  }
  const id = setInterval(onTick, intervalMs);
  return () => clearInterval(id);
}

/** Where the bubble goes inside a frame, in canvas pixels. */
export function webcamRect(layout: WebcamLayout, width: number, height: number) {
  const size = Math.round(height * WEBCAM_SIZE_RATIO[layout.size]);
  const margin = Math.round(Math.min(width, height) * MARGIN_RATIO);
  const left = layout.position.endsWith("left");
  const top = layout.position.startsWith("top");
  return { x: left ? margin : width - margin - size, y: top ? margin : height - margin - size, size };
}

function hiddenVideo(stream: MediaStream): HTMLVideoElement {
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.srcObject = stream;
  void video.play().catch(() => undefined);
  return video;
}

export class Compositor {
  readonly canvas: HTMLCanvasElement;
  readonly stream: MediaStream;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly screenVideo: HTMLVideoElement;
  private readonly cameraVideo: HTMLVideoElement | null;
  private layout: WebcamLayout;
  private cameraVisible = true;
  private stopTicker: (() => void) | null = null;

  constructor(screen: MediaStream, camera: MediaStream | null, layout: WebcamLayout, private readonly fps = 30) {
    const settings = screen.getVideoTracks()[0]?.getSettings() ?? {};
    const sourceWidth = settings.width ?? 1920;
    const sourceHeight = settings.height ?? 1080;
    const scale = Math.min(1, MAX_WIDTH / sourceWidth);
    this.canvas = document.createElement("canvas");
    // Even dimensions: some encoders reject odd sizes.
    this.canvas.width = Math.round((sourceWidth * scale) / 2) * 2;
    this.canvas.height = Math.round((sourceHeight * scale) / 2) * 2;
    const ctx = this.canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("Canvas 2D is unavailable");
    this.ctx = ctx;
    this.layout = layout;
    this.screenVideo = hiddenVideo(screen);
    this.cameraVideo = camera ? hiddenVideo(camera) : null;
    this.stream = this.canvas.captureStream(fps);
  }

  start() {
    this.draw();
    this.stopTicker = startTicker(1000 / this.fps, () => this.draw());
  }

  setLayout(layout: WebcamLayout) {
    this.layout = layout;
  }

  setCameraVisible(visible: boolean) {
    this.cameraVisible = visible;
  }

  private draw() {
    const { ctx, canvas, screenVideo, cameraVideo } = this;
    const { width, height } = canvas;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, width, height);

    // Screen, letterboxed if the shared window was resized to a different shape.
    if (screenVideo.videoWidth && screenVideo.videoHeight) {
      const scale = Math.min(width / screenVideo.videoWidth, height / screenVideo.videoHeight);
      const w = screenVideo.videoWidth * scale;
      const h = screenVideo.videoHeight * scale;
      ctx.drawImage(screenVideo, (width - w) / 2, (height - h) / 2, w, h);
    }

    if (!cameraVideo || !this.cameraVisible || !cameraVideo.videoWidth) return;
    const { x, y, size } = webcamRect(this.layout, width, height);
    // Cover-crop the camera frame into a square.
    const side = Math.min(cameraVideo.videoWidth, cameraVideo.videoHeight);
    const sx = (cameraVideo.videoWidth - side) / 2;
    const sy = (cameraVideo.videoHeight - side) / 2;

    ctx.save();
    ctx.beginPath();
    if (this.layout.shape === "circle") ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
    else ctx.roundRect(x, y, size, size, size * 0.14);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(cameraVideo, sx, sy, side, side, x, y, size, size);
    ctx.restore();

    ctx.save();
    ctx.lineWidth = Math.max(2, size * 0.015);
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.beginPath();
    if (this.layout.shape === "circle") ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
    else ctx.roundRect(x, y, size, size, size * 0.14);
    ctx.stroke();
    ctx.restore();
  }

  /** Stops drawing and releases the canvas, its stream and the hidden players. Source streams are the caller's to stop. */
  dispose() {
    this.stopTicker?.();
    this.stopTicker = null;
    for (const track of this.stream.getTracks()) track.stop();
    for (const video of [this.screenVideo, this.cameraVideo]) {
      if (!video) continue;
      video.pause();
      video.srcObject = null;
    }
    // A zero-size canvas frees its backing store right away.
    this.canvas.width = 0;
    this.canvas.height = 0;
  }
}
