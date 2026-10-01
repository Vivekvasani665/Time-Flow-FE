import type { ListParams, UserRef } from "./api";

/** The entire display, the display with a webcam bubble, or the webcam alone. Window / tab capture is not offered. */
export type RecordingType = "FULL_SCREEN" | "SCREEN_WEBCAM" | "WEBCAM";

export type Recording = {
  id: string;
  title: string;
  description: string | null;
  tags: string[];
  mimeType: string;
  /** Bytes, as measured by the server once the upload completed. */
  fileSize: number;
  /** Seconds. */
  duration: number | null;
  recordingType: RecordingType;
  createdAt: string;
  updatedAt: string;
  owner: UserRef;
  project: { id: string; name: string } | null;
  /** Short-lived signed URL. */
  thumbnailUrl: string | null;
  /** Owner, the attached project's manager, or a recordings administrator. */
  canDelete: boolean;
};

/** `GET /recordings/:id` — adds signed playback and download URLs. */
export type RecordingDetail = Recording & {
  playbackUrl: string;
  downloadUrl: string;
  urlsExpireAt: string;
};

export type RecordingSortKey = "createdAt" | "title" | "duration" | "fileSize";

export type RecordingListParams = ListParams & {
  recordingType?: RecordingType;
  projectId?: string;
  mine?: boolean;
};

/** A request the browser makes straight to object storage, with headers that are part of its signature. */
export type SignedUpload = {
  url: string;
  method: "PUT";
  headers: Record<string, string>;
  expiresAt: string;
};

export type UploadTicket = {
  recordingId: string;
  maxBytes: number;
  upload: SignedUpload;
  thumbnailUpload: SignedUpload | null;
};

export type CreateUploadInput = {
  mimeType: string;
  fileSize: number;
  recordingType: RecordingType;
  projectId?: string | null;
  thumbnail?: { mimeType: string; fileSize: number };
};

export type CompleteUploadInput = {
  recordingId: string;
  title: string;
  description?: string | null;
  tags?: string[];
  projectId?: string | null;
  duration?: number | null;
  recordingType: RecordingType;
};
