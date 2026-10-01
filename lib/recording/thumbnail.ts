const WIDTH = 640;
const TIMEOUT_MS = 4000;

/**
 * A JPEG poster frame from a local recording, for the recordings grid. Tries a
 * frame a moment in (the very first one is often black), falling back to the
 * first frame — MediaRecorder WebM files have no index, so seeking can fail.
 * Resolves null rather than throwing: a recording is fine without a thumbnail.
 */
export function captureThumbnail(url: string): Promise<Blob | null> {
  if (typeof document === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    let settled = false;

    const finish = (blob: Blob | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      video.removeAttribute("src");
      video.load();
      resolve(blob);
    };

    const draw = () => {
      if (!video.videoWidth || !video.videoHeight) return finish(null);
      const canvas = document.createElement("canvas");
      canvas.width = WIDTH;
      canvas.height = Math.round((WIDTH * video.videoHeight) / video.videoWidth / 2) * 2;
      const ctx = canvas.getContext("2d");
      if (!ctx) return finish(null);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          canvas.width = 0;
          canvas.height = 0;
          finish(blob);
        },
        "image/jpeg",
        0.8,
      );
    };

    // Seeking failed or is slow: the first frame is better than nothing.
    const timer = setTimeout(() => (video.readyState >= 2 ? draw() : finish(null)), TIMEOUT_MS);
    video.addEventListener("seeked", draw, { once: true });
    video.addEventListener("error", () => finish(null), { once: true });
    video.addEventListener(
      "loadeddata",
      () => {
        const target = Number.isFinite(video.duration) ? Math.min(1, video.duration / 3) : 1;
        try {
          video.currentTime = target;
        } catch {
          draw();
        }
      },
      { once: true },
    );
    video.src = url;
  });
}
