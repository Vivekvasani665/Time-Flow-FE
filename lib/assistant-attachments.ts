import { isApiError } from "@/lib/api/errors";
import { assistantService } from "@/services/assistant.service";
import type { AssistantAttachment } from "@/types/chat";

/** Mirrors the API's limits (src/modules/assistant). */
export const ASSISTANT_ATTACHMENT_LIMITS = {
  perMessage: 5,
  /** Images sent in one request; older ones are left out first. */
  images: 4,
  /** Document text sent in one request; older files are left out first. */
  documentChars: 120_000,
  documentBytes: 10 * 1024 * 1024,
  imageBytes: 20 * 1024 * 1024,
} as const;

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
const DOCUMENT_EXTENSIONS = [".pdf", ".docx", ".txt", ".md", ".csv"];

export const ASSISTANT_ACCEPT = [...IMAGE_TYPES, ...DOCUMENT_EXTENSIONS].join(",");

/** Longest edge sent to the model: plenty to read a screenshot, small enough to send quickly. */
const MAX_EDGE = 1600;
/** The vision model refuses anything narrower. */
const MIN_EDGE = 32;
const MAX_DATA_URL = 1_450_000;

export class AttachmentError extends Error {}

const extension = (name: string) => name.slice(name.lastIndexOf(".")).toLowerCase();

export const isImageFile = (file: File) => IMAGE_TYPES.includes(file.type);

/** Re-encodes an image as a JPEG no larger than MAX_EDGE, which also strips its metadata (e.g. location). */
async function resizeImage(file: File): Promise<string> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new AttachmentError(`${file.name} couldn't be opened as an image.`);
  }
  const shrink = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const grow = Math.max(1, MIN_EDGE / Math.min(bitmap.width * shrink, bitmap.height * shrink));
  const width = Math.round(bitmap.width * shrink * grow);
  const height = Math.round(bitmap.height * shrink * grow);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new AttachmentError(`${file.name} couldn't be prepared.`);
  // JPEG has no transparency; a white page reads better than black.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  for (const quality of [0.85, 0.7, 0.5]) {
    const url = canvas.toDataURL("image/jpeg", quality);
    if (url.length <= MAX_DATA_URL) return url;
  }
  throw new AttachmentError(`${file.name} is too detailed to send. Try a smaller image or a cropped screenshot.`);
}

/** Turns a picked file into something the assistant can read. Throws AttachmentError with words for the user. */
export async function prepareAttachment(file: File): Promise<AssistantAttachment> {
  if (isImageFile(file)) {
    if (file.size > ASSISTANT_ATTACHMENT_LIMITS.imageBytes) throw new AttachmentError(`${file.name} is larger than 20 MB.`);
    return { kind: "image", name: file.name, dataUrl: await resizeImage(file) };
  }
  if (!DOCUMENT_EXTENSIONS.includes(extension(file.name))) {
    throw new AttachmentError(`${file.name} can't be read. Attach an image (PNG, JPEG, WebP) or a PDF, Word, TXT, Markdown or CSV file.`);
  }
  if (file.size > ASSISTANT_ATTACHMENT_LIMITS.documentBytes) throw new AttachmentError(`${file.name} is larger than 10 MB.`);
  try {
    return await assistantService.readDocument(file);
  } catch (error) {
    if (isApiError(error) && error.status > 0 && error.status < 500) throw new AttachmentError(error.message);
    throw new AttachmentError(`${file.name} couldn't be read. Please try again.`);
  }
}
