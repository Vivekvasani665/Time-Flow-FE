import { act, fireEvent, renderHook, screen, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RecorderProvider } from "@/components/recordings/recorder-provider";
import { RecordingPreview } from "@/components/recordings/recording-preview";
import { RecordingsPage } from "@/components/recordings/recordings-page";
import { useSaveRecording } from "@/hooks/use-recordings";
import type { Recording } from "@/types/recording";
import { createTestQueryClient, makeAuthUser, renderWithProviders } from "./utils";

const service = vi.hoisted(() => ({
  list: vi.fn(),
  get: vi.fn(),
  remove: vi.fn(),
  createUpload: vi.fn(),
  complete: vi.fn(),
  upload: vi.fn(),
}));

vi.mock("@/services/recordings.service", () => ({
  recordingsService: { list: service.list, get: service.get, remove: service.remove, createUpload: service.createUpload, complete: service.complete },
  uploadToStorage: service.upload,
  StorageUploadError: class extends Error {},
}));

vi.mock("@/services/projects.service", () => ({
  projectsService: { list: vi.fn().mockResolvedValue({ items: [{ id: "p1", name: "Apollo" }], meta: { page: 1, limit: 100, total: 1, totalPages: 1 } }) },
}));

const me = makeAuthUser();

const recording = (overrides: Partial<Recording> = {}): Recording => ({
  id: "r1",
  title: "Sprint demo",
  description: null,
  tags: [],
  mimeType: "video/webm",
  fileSize: 1024,
  duration: 75,
  recordingType: "SCREEN_WEBCAM",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  owner: { id: me.id, firstName: me.firstName, lastName: me.lastName, email: me.email, avatarUrl: null },
  project: { id: "p1", name: "Apollo" },
  thumbnailUrl: null,
  canDelete: true,
  ...overrides,
});

beforeEach(() => {
  service.list.mockResolvedValue({
    items: [recording(), recording({ id: "r2", title: "Bug repro", owner: { id: "u2", firstName: "Zoe", lastName: "Chen", email: "z@t.dev", avatarUrl: null }, project: null, recordingType: "BROWSER_TAB", canDelete: false, duration: 3725 })],
    meta: { page: 1, limit: 12, total: 2, totalPages: 1 },
  });
});

describe("Recordings page", () => {
  it("lists recordings as cards with type, duration, project and owner", async () => {
    renderWithProviders(
      <RecorderProvider>
        <RecordingsPage />
      </RecorderProvider>,
    );
    expect(await screen.findByRole("link", { name: "Sprint demo" })).toHaveAttribute("href", "/recordings/r1");
    expect(screen.getByRole("heading", { name: "Recordings" })).toBeInTheDocument();
    expect(screen.getByText("1:15")).toBeInTheDocument();
    expect(screen.getByText("1:02:05")).toBeInTheDocument();
    expect(screen.getAllByText("Apollo").length).toBeGreaterThan(0);
    expect(screen.getByText("You")).toBeInTheDocument();
    expect(screen.getByText("Zoe Chen")).toBeInTheDocument();
    expect(screen.getByText("Screen + camera")).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Search recordings" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "New Recording" }).length).toBeGreaterThan(0);
    expect(service.list).toHaveBeenCalledWith(expect.objectContaining({ limit: 12, sortBy: "createdAt", sortOrder: "desc" }));
  });

  it("shows an empty state that invites the first recording", async () => {
    service.list.mockResolvedValue({ items: [], meta: { page: 1, limit: 12, total: 0, totalPages: 1 } });
    renderWithProviders(
      <RecorderProvider>
        <RecordingsPage />
      </RecorderProvider>,
    );
    expect(await screen.findByText("No recordings yet")).toBeInTheDocument();
  });
});

describe("Recording preview", () => {
  const result = { url: "blob:x", size: 2 * 1024 * 1024, mimeType: "video/webm", durationSeconds: 42, recordingType: "FULL_SCREEN" as const };

  it("shows the recording's facts and saves only when asked", async () => {
    const onSave = vi.fn();
    renderWithProviders(<RecordingPreview status="PREVIEW" result={result} error={null} progress={0} onSave={onSave} onDiscard={vi.fn()} onCancelUpload={vi.fn()} />);
    expect(screen.getByText("0:42")).toBeInTheDocument();
    expect(screen.getByText("2.0 MB")).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/Title/), { target: { value: "  Onboarding walkthrough " } });
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "For new hires" } });
    const tags = screen.getByLabelText("Tags");
    fireEvent.change(tags, { target: { value: "onboarding" } });
    fireEvent.keyDown(tags, { key: "Enter" });
    fireEvent.click(screen.getByRole("button", { name: "Save Recording" }));
    expect(onSave).toHaveBeenCalledWith({
      title: "Onboarding walkthrough",
      description: "For new hires",
      projectId: null,
      tags: ["onboarding"],
      duration: 42,
      recordingType: "FULL_SCREEN",
    });
  });

  it("requires a title and confirms before discarding", async () => {
    const onSave = vi.fn();
    const onDiscard = vi.fn();
    renderWithProviders(<RecordingPreview status="PREVIEW" result={result} error={null} progress={0} onSave={onSave} onDiscard={onDiscard} onCancelUpload={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/Title/), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "Save Recording" }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Give the recording a title");

    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(onDiscard).not.toHaveBeenCalled();
    const confirm = await screen.findByRole("dialog", { name: "Discard this recording?" });
    fireEvent.click(Array.from(confirm.querySelectorAll("button")).find((b) => b.textContent === "Discard")!);
    expect(onDiscard).toHaveBeenCalled();
  });

  it("reports upload progress and keeps the recording when an upload fails", () => {
    const { rerender } = renderWithProviders(<RecordingPreview status="UPLOADING" result={result} error={null} progress={0.4} onSave={vi.fn()} onDiscard={vi.fn()} onCancelUpload={vi.fn()} />);
    expect(screen.getByRole("progressbar", { name: "Upload progress" })).toHaveAttribute("aria-valuenow", "40");
    rerender(<RecordingPreview status="UPLOAD_FAILED" result={result} error="The upload failed." progress={0.4} onSave={vi.fn()} onDiscard={vi.fn()} onCancelUpload={vi.fn()} />);
    expect(screen.getByRole("alert")).toHaveTextContent("The upload failed. Your recording is still here");
    expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled();
  });
});

describe("useSaveRecording", () => {
  it("reserves, uploads straight to storage with progress, then confirms", async () => {
    const order: string[] = [];
    service.createUpload.mockImplementation(async () => {
      order.push("upload-url");
      return {
        recordingId: "rec-1",
        maxBytes: 1e9,
        upload: { url: "https://bucket.example/video", method: "PUT", headers: { "Content-Type": "video/webm" }, expiresAt: "" },
        thumbnailUpload: { url: "https://bucket.example/thumb", method: "PUT", headers: { "Content-Type": "image/jpeg" }, expiresAt: "" },
      };
    });
    service.upload.mockImplementation(async (target: { url: string }, _blob: Blob, opts?: { onProgress?: (f: number) => void }) => {
      order.push(`put ${target.url}`);
      opts?.onProgress?.(0.5);
    });
    service.complete.mockImplementation(async (input: { recordingId: string }) => {
      order.push("complete");
      return { ...recording(), id: input.recordingId };
    });

    const client = createTestQueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const { result } = renderHook(() => useSaveRecording(), { wrapper });
    const video = new Blob(["v".repeat(100)], { type: "video/webm" });
    const thumbnail = new Blob(["t"], { type: "image/jpeg" });

    await act(async () => {
      await result.current.mutateAsync({ video, thumbnail, details: { title: "Demo", recordingType: "WINDOW", duration: 9, tags: [], projectId: "p1" } });
    });

    expect(order).toEqual(["upload-url", "put https://bucket.example/video", "put https://bucket.example/thumb", "complete"]);
    expect(service.createUpload).toHaveBeenCalledWith({ mimeType: "video/webm", fileSize: 100, recordingType: "WINDOW", projectId: "p1", thumbnail: { mimeType: "image/jpeg", fileSize: 1 } });
    expect(service.complete).toHaveBeenCalledWith(expect.objectContaining({ recordingId: "rec-1", title: "Demo", duration: 9 }));
    await waitFor(() => expect(result.current.progress).toBe(0.5));
  });
});
