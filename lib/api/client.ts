import type { ApiFailure, ApiSuccess, Paginated } from "@/types/api";
import { ApiError, logDiagnostic } from "./errors";

export { ApiError, describeError, getUserFriendlyError, isApiError, type FriendlyError } from "./errors";

type Query = Record<string, string | number | boolean | undefined | null>;

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  query?: Query;
  signal?: AbortSignal;
  /** Skip the refresh-and-retry dance (used by auth endpoints themselves). */
  skipAuthRefresh?: boolean;
};

const API_BASE = "/api";

export function buildQuery(query?: Query): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

/**
 * Session lifecycle. The access cookie is httpOnly, so the API advertises its
 * expiry in a response header. We refresh shortly *before* it lapses (timer),
 * and again right before any request if the timer was throttled (sleeping
 * laptop, background tab) — so normal use never produces a 401. The 401 →
 * refresh → retry path below stays as the last line of defence.
 */
const SESSION_EXPIRES_HEADER = "X-Session-Expires-At";
const REFRESH_LEAD_MS = 60_000;

const SESSION_STORAGE_KEY = "tf.sessionExpiresAt";

// Persisted so a reload (or another tab) after a long idle refreshes *before* its first request.
let sessionExpiresAt: number | null = readStoredExpiry();
let refreshTimer: ReturnType<typeof setTimeout> | null = null;

function readStoredExpiry(): number | null {
  try {
    const value = Number(globalThis.localStorage?.getItem(SESSION_STORAGE_KEY));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

function storeExpiry(value: number | null) {
  try {
    if (value === null) globalThis.localStorage?.removeItem(SESSION_STORAGE_KEY);
    else globalThis.localStorage?.setItem(SESSION_STORAGE_KEY, String(value));
  } catch {
    /* storage unavailable (private mode) — in-memory tracking still works */
  }
}

function clearRefreshTimer() {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = null;
}

/** Forget the tracked session (logout, failed refresh). */
export function resetSessionTracking() {
  sessionExpiresAt = null;
  storeExpiry(null);
  clearRefreshTimer();
}

function trackSessionExpiry(res: Response) {
  const expiresAt = Date.parse(res.headers.get(SESSION_EXPIRES_HEADER) ?? "");
  if (Number.isNaN(expiresAt) || expiresAt === sessionExpiresAt) return;
  sessionExpiresAt = expiresAt;
  storeExpiry(expiresAt);
  if (typeof window === "undefined") return;
  clearRefreshTimer();
  refreshTimer = setTimeout(
    () => {
      refreshTimer = null;
      void refreshSession();
    },
    Math.max(expiresAt - REFRESH_LEAD_MS - Date.now(), 0),
  );
}

function sessionNeedsRefresh() {
  return sessionExpiresAt !== null && Date.now() >= sessionExpiresAt - REFRESH_LEAD_MS;
}

// Single-flight refresh: concurrent callers share one refresh request.
let refreshPromise: Promise<boolean> | null = null;

function refreshSession(): Promise<boolean> {
  refreshPromise ??= fetch(`${API_BASE}/auth/refresh`, { method: "POST", credentials: "include" })
    .then((res) => {
      if (res.ok) trackSessionExpiry(res);
      else resetSessionTracking();
      return res.ok;
    })
    .catch(() => false)
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}

/** Refreshes first if the access token is about to lapse. For non-fetch transports (EventSource). */
export async function ensureFreshSession(): Promise<void> {
  if (sessionNeedsRefresh()) await refreshSession();
}

/** Pages a signed-out visitor is meant to be on; a 401 there must never bounce them to /login. */
const PUBLIC_PATHS = ["/login", "/signup", "/reset-password", "/accept-invitation"];
export const SESSION_EXPIRED_REASON = "session-expired";

// Several requests can 401 at once when a session dies; only the first navigates.
let redirectingToLogin = false;

let onSessionExpired: () => void = () => {
  resetSessionTracking();
  if (typeof window === "undefined" || redirectingToLogin) return;
  const { pathname, search } = window.location;
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return;
  redirectingToLogin = true;
  const next = encodeURIComponent(pathname + search);
  window.location.assign(`/login?reason=${SESSION_EXPIRED_REASON}&next=${next}`);
};

export function setSessionExpiredHandler(handler: () => void) {
  onSessionExpired = handler;
}

async function parseFailure(res: Response, method: string, path: string): Promise<ApiError> {
  let payload: (Partial<ApiFailure> & { debug?: string }) | null = null;
  try {
    payload = (await res.json()) as Partial<ApiFailure> & { debug?: string };
  } catch {
    // A proxy or gateway page (502/504) rather than the API's JSON envelope.
    payload = null;
  }
  const error = new ApiError(
    res.status,
    payload?.code ?? (res.status === 429 ? "RATE_LIMITED" : res.status >= 500 ? "INTERNAL_ERROR" : "HTTP_ERROR"),
    payload?.message ?? res.statusText ?? "",
    payload?.details ?? [],
    payload?.requestId,
  );
  logDiagnostic(res.status >= 500 ? "warn" : "info", `${method} ${path} → ${res.status} ${error.code}: ${error.serverMessage}`, {
    serverMessage: error.serverMessage,
    requestId: error.requestId,
    details: error.details,
    debug: payload?.debug,
  });
  return error;
}

async function send(path: string, options: RequestOptions): Promise<Response> {
  const { method = "GET", body, query, signal } = options;
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  const headers: HeadersInit = { Accept: "application/json" };
  if (body !== undefined && !isForm) headers["Content-Type"] = "application/json";

  return fetch(`${API_BASE}${path}${buildQuery(query)}`, {
    method,
    headers,
    credentials: "include",
    signal,
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
  });
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<ApiSuccess<T>> {
  if (!options.skipAuthRefresh) await ensureFreshSession();

  let res: Response;
  try {
    res = await send(path, options);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    logDiagnostic("warn", `${options.method ?? "GET"} ${path} → network error`, { cause: error });
    throw new ApiError(0, "NETWORK_ERROR", error instanceof Error ? error.message : "Network request failed");
  }

  trackSessionExpiry(res);

  if (res.status === 401 && !options.skipAuthRefresh) {
    const refreshed = await refreshSession();
    if (refreshed) {
      res = await send(path, options);
    }
    if (res.status === 401) {
      onSessionExpired();
    }
  }

  if (!res.ok) throw await parseFailure(res, options.method ?? "GET", path);
  if (res.status === 204) return { success: true, data: undefined as T };
  return (await res.json()) as ApiSuccess<T>;
}

export const api = {
  get: async <T>(path: string, query?: Query, signal?: AbortSignal) =>
    (await request<T>(path, { query, signal })).data,
  list: async <T>(path: string, query?: Query, signal?: AbortSignal): Promise<Paginated<T>> => {
    const res = await request<T[]>(path, { query, signal });
    return {
      items: res.data,
      meta: res.meta ?? { page: 1, limit: res.data.length, total: res.data.length, totalPages: 1 },
    };
  },
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

export function toQuery<T extends object>(params: T): Query {
  return params as unknown as Query;
}
