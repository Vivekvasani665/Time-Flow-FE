import { callService } from "@/services/call.service";

const DEFAULT_STUN = "stun:stun.l.google.com:19302";
/** Server-issued TURN credentials are short-lived; fetch fresh ones for each call after this. */
const CACHE_MS = 30 * 60_000;

let cached: { servers: RTCIceServer[]; at: number } | null = null;

const list = (value: string | undefined) =>
  (value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

/**
 * Build-time fallback, used only when the API can't be reached: the
 * NEXT_PUBLIC_* values are visible to every visitor, so put only a public
 * STUN server (or a deliberately public TURN) here. Prefer configuring TURN on
 * the backend, which hands out per-user, expiring credentials.
 */
export function fallbackIceServers(): RTCIceServer[] {
  const stun = list(process.env.NEXT_PUBLIC_STUN_SERVER);
  const turn = list(process.env.NEXT_PUBLIC_TURN_SERVER);
  const servers: RTCIceServer[] = [{ urls: stun.length ? stun : [DEFAULT_STUN] }];
  const username = process.env.NEXT_PUBLIC_TURN_USERNAME;
  const credential = process.env.NEXT_PUBLIC_TURN_CREDENTIAL;
  if (turn.length && username && credential) servers.push({ urls: turn, username, credential });
  return servers;
}

/** STUN/TURN servers for a new call: from the API (with fresh TURN credentials), else the build-time fallback. */
export async function resolveIceServers(): Promise<RTCIceServer[]> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.servers;
  try {
    const servers = await callService.iceServers();
    if (servers.length) {
      cached = { servers, at: Date.now() };
      return servers;
    }
  } catch {
    /* fall through to the build-time servers; the call may still connect directly */
  }
  return fallbackIceServers();
}

/** For tests. */
export function resetIceServerCache() {
  cached = null;
}
