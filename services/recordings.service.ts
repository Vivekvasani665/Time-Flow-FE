import { api, toQuery } from "@/lib/api/client";
import type { CompleteUploadInput, CreateUploadInput, Recording, RecordingDetail, RecordingListParams, SignedUpload, UploadTicket } from "@/types/recording";

/** Failure while sending the file to storage (as opposed to an API error). */
export class StorageUploadError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "StorageUploadError";
  }
}

/**
 * PUTs a file straight to object storage through a signed URL. XHR rather than
 * fetch because fetch can't report upload progress. No credentials are sent:
 * the signature in the URL is the whole authorisation.
 */
export function uploadToStorage(target: SignedUpload, file: Blob, { onProgress, signal }: { onProgress?: (fraction: number) => void; signal?: AbortSignal } = {}) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException("Aborted", "AbortError"));
    const xhr = new XMLHttpRequest();
    xhr.open(target.method, target.url);
    for (const [name, value] of Object.entries(target.headers)) xhr.setRequestHeader(name, value);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(1);
        resolve();
      } else {
        reject(new StorageUploadError(xhr.status === 413 ? "The recording is too large to upload." : "The upload was rejected by storage. Please try again.", xhr.status));
      }
    };
    xhr.onerror = () => reject(new StorageUploadError("The upload failed. Check your connection and try again.", 0));
    xhr.onabort = () => reject(new DOMException("Aborted", "AbortError"));
    signal?.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(file);
  });
}

export const recordingsService = {
  list: (params: RecordingListParams) => api.list<Recording>("/recordings", toQuery(params)),
  get: (id: string) => api.get<RecordingDetail>(`/recordings/${id}`),
  remove: async (id: string) => {
    await api.delete<null>(`/recordings/${id}`);
  },
  createUpload: async (input: CreateUploadInput) => (await api.post<UploadTicket>("/recordings/upload-url", input)).data,
  complete: async (input: CompleteUploadInput) => (await api.post<RecordingDetail>("/recordings/complete", input)).data,
};
