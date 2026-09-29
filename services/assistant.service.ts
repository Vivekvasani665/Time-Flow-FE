import { api, ApiError, ensureFreshSession, refreshSession } from "@/lib/api/client";
import type { AssistantEvent, AssistantStatus } from "@/types/chat";

export type AssistantTurn = { role: "user" | "assistant"; content: string };

async function post(body: unknown, signal: AbortSignal): Promise<Response> {
  return fetch("/api/assistant/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    credentials: "include",
    body: JSON.stringify(body),
    signal,
  });
}

/** Splits an SSE buffer into complete events; returns the unfinished tail. */
function drain(buffer: string, onEvent: (event: AssistantEvent) => void): string {
  const blocks = buffer.split("\n\n");
  const rest = blocks.pop() ?? "";
  for (const block of blocks) {
    const data = block
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .join("");
    if (!data) continue;
    try {
      onEvent(JSON.parse(data) as AssistantEvent);
    } catch {
      /* a malformed frame is skipped rather than ending the reply */
    }
  }
  return rest;
}

export const assistantService = {
  status: () => api.get<AssistantStatus>("/assistant/status"),

  /**
   * Asks the assistant and streams its answer through `onEvent`. Rejects with
   * an ApiError when the request is refused before streaming (not set up,
   * rate limited, invalid, offline); errors mid-answer arrive as `error` events.
   * Uses fetch directly because the JSON client can't read a stream.
   */
  async chat(messages: AssistantTurn[], onEvent: (event: AssistantEvent) => void, signal: AbortSignal): Promise<void> {
    await ensureFreshSession();
    let res: Response;
    try {
      res = await post({ messages }, signal);
      if (res.status === 401 && (await refreshSession())) res = await post({ messages }, signal);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") throw error;
      throw new ApiError(0, "NETWORK_ERROR", "Network request failed");
    }

    if (!res.ok || !res.body) {
      const payload = (await res.json().catch(() => null)) as { code?: string; message?: string } | null;
      throw new ApiError(res.status, payload?.code ?? "HTTP_ERROR", payload?.message ?? res.statusText);
    }

    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer = drain(buffer + value, onEvent);
    }
    drain(buffer + "\n\n", onEvent);
  },
};
