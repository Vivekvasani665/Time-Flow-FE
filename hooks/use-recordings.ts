"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import { queryKeys } from "@/lib/query-keys";
import { recordingsService, uploadToStorage } from "@/services/recordings.service";
import type { CompleteUploadInput, RecordingListParams } from "@/types/recording";

export function useRecordings(params: RecordingListParams) {
  return useQuery({
    queryKey: queryKeys.recordings.list(params),
    queryFn: () => recordingsService.list(params),
    placeholderData: keepPreviousData,
  });
}

/**
 * Detail with signed playback URLs. Refetching would swap the video source and
 * restart playback, so it is not refreshed on focus; the player asks for fresh
 * URLs itself when the old ones expire.
 */
export function useRecording(id: string) {
  return useQuery({
    queryKey: queryKeys.recordings.detail(id),
    queryFn: () => recordingsService.get(id),
    enabled: Boolean(id),
    staleTime: 30 * 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useDeleteRecording() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => recordingsService.remove(id),
    onSuccess: (_data, id) => {
      qc.removeQueries({ queryKey: queryKeys.recordings.detail(id) });
      void qc.invalidateQueries({ queryKey: queryKeys.recordings.all });
    },
  });
}

export type SaveRecordingInput = {
  video: Blob;
  thumbnail: Blob | null;
  details: Omit<CompleteUploadInput, "recordingId">;
};

/**
 * Saves a finished recording: reserve → upload the file straight to storage
 * (with progress) → confirm. Only ever called from an explicit "Save".
 */
export function useSaveRecording() {
  const qc = useQueryClient();
  const [progress, setProgress] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const mutation = useMutation({
    mutationFn: async ({ video, thumbnail, details }: SaveRecordingInput) => {
      const abort = new AbortController();
      abortRef.current = abort;
      setProgress(0);
      const ticket = await recordingsService.createUpload({
        mimeType: video.type,
        fileSize: video.size,
        recordingType: details.recordingType,
        projectId: details.projectId ?? null,
        thumbnail: thumbnail ? { mimeType: thumbnail.type, fileSize: thumbnail.size } : undefined,
      });
      await Promise.all([
        uploadToStorage(ticket.upload, video, { onProgress: setProgress, signal: abort.signal }),
        // The thumbnail is a nicety; the server drops it if it didn't arrive.
        ticket.thumbnailUpload && thumbnail ? uploadToStorage(ticket.thumbnailUpload, thumbnail, { signal: abort.signal }).catch(() => undefined) : null,
      ]);
      return recordingsService.complete({ recordingId: ticket.recordingId, ...details });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.recordings.all });
    },
    onSettled: () => {
      abortRef.current = null;
    },
  });

  const cancel = useCallback(() => abortRef.current?.abort(), []);
  return { ...mutation, progress, cancel };
}
