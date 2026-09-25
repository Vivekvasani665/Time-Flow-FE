import type { ValidationDetail } from "@/types/api";

/**
 * The one place that decides what a user reads when a request fails.
 *
 * Every error the API client throws passes through `getUserFriendlyError`, and
 * `ApiError.message` is already the friendly text, so components can show
 * `error.message` without leaking anything. What the server actually said is
 * kept on `serverMessage` for the console, never the screen.
 */

export type ErrorKind =
  | "bad-request"
  | "validation"
  | "auth"
  | "forbidden"
  | "not-found"
  | "conflict"
  | "rate-limit"
  | "server"
  | "network"
  | "unknown";

export type FriendlyError = {
  title: string;
  message: string;
  /** Whether trying the same request again could plausibly succeed. */
  canRetry: boolean;
  kind: ErrorKind;
};

const copy = (kind: ErrorKind, title: string, message: string, canRetry = false): FriendlyError => ({ kind, title, message, canRetry });

export const NETWORK_ERROR = copy(
  "network",
  "Connection Problem",
  "We’re having trouble connecting to the server. Please check your connection and try again.",
  true,
);

export const UNKNOWN_ERROR = copy("unknown", "Something Went Wrong", "We couldn’t complete your request. Please try again in a moment.", true);

const SESSION_EXPIRED = "Your session has expired. Please sign in again to continue.";
const SIGN_IN_REQUIRED = "Please sign in to continue.";

const BY_STATUS = {
  400: copy("bad-request", "Invalid Request", "We couldn’t process your request. Please check your information and try again."),
  401: copy("auth", "Session Expired", SESSION_EXPIRED),
  403: copy("forbidden", "Access Denied", "You don’t have permission to perform this action."),
  404: copy("not-found", "Not Found", "We couldn’t find what you’re looking for. It may have been moved or removed."),
  405: copy("bad-request", "Action Not Available", "This action isn’t available right now. Please try again."),
  408: copy("server", "Request Timed Out", "The request is taking longer than expected. Please try again.", true),
  409: copy("conflict", "Conflict", "This action conflicts with existing information. Please review your details and try again."),
  410: copy("not-found", "Link No Longer Valid", "This link has expired or has already been used."),
  413: copy("bad-request", "File Too Large", "The file or data you sent is too large. Please use a smaller one."),
  422: copy("validation", "Check Your Information", "Some of the information you entered isn’t valid. Please check your details and try again."),
  429: copy("rate-limit", "Too Many Requests", "You’ve made too many requests. Please wait a moment and try again."),
  500: copy("server", "Something Went Wrong", "Something went wrong on our end. Please try again shortly.", true),
  502: copy("server", "Connection Problem", "We’re having trouble connecting to the server. Please try again in a moment.", true),
  503: copy("server", "Service Temporarily Unavailable", "The service is temporarily unavailable. Please try again shortly.", true),
  504: copy("server", "Request Timed Out", "The request is taking longer than expected. Please try again.", true),
} satisfies Record<number, FriendlyError>;

type KnownStatus = keyof typeof BY_STATUS;

function forStatus(status: number): FriendlyError {
  if (status in BY_STATUS) return BY_STATUS[status as KnownStatus];
  if (status >= 500) return BY_STATUS[500];
  if (status >= 400) return BY_STATUS[400];
  return UNKNOWN_ERROR;
}

/**
 * Codes whose server message is plumbing, not prose — the status default reads better.
 * Everything else under 500 is a message the API wrote for the person using it
 * ("A user with this email already exists", "You cannot delete your own account").
 */
const GENERIC_CODES = new Set(["ROUTE_NOT_FOUND", "CONFLICT", "INTERNAL_ERROR"]);

/** Belt and braces: a 4xx message that looks like a stack trace or ORM error is never shown. */
const TECHNICAL = /prisma|invocation|sql|stack|errno|econn|jwt|token_version|malformed json|\bat \S+ \(|[\\/][\w.-]+\.(ts|js|tsx)\b|\bundefined\b|\bnull\b/i;

const isPresentable = (message: string | undefined): message is string =>
  !!message && message.length <= 300 && !TECHNICAL.test(message);

export type ErrorResponse = { code?: string; message?: string; details?: ValidationDetail[] };

/**
 * status + the API's error envelope → what to show. Status 0 means the request
 * never got an answer (offline, DNS, server down, CORS).
 */
export function getUserFriendlyError(statusCode: number | undefined, errorResponse: ErrorResponse = {}): FriendlyError {
  const { code, message } = errorResponse;
  if (!statusCode) return { ...NETWORK_ERROR };

  // 5xx: whatever the server said stays in the console.
  if (statusCode >= 500) return { ...forStatus(statusCode) };

  if (statusCode === 401 && (code === "UNAUTHENTICATED" || !code)) {
    return { ...BY_STATUS[401], message: message === "Authentication required" ? SIGN_IN_REQUIRED : SESSION_EXPIRED };
  }

  if (code === "VALIDATION_ERROR" || statusCode === 422) {
    const base = BY_STATUS[422];
    return { ...base, message: message && message !== "Validation failed" && isPresentable(message) ? message : base.message };
  }

  const base = forStatus(statusCode);
  if (code && GENERIC_CODES.has(code)) return { ...base };
  return { ...base, message: isPresentable(message) ? message : base.message };
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: ValidationDetail[];
  readonly requestId?: string;
  /** What the server actually said — for logs and debugging, not for display. */
  readonly serverMessage: string;
  readonly friendly: FriendlyError;

  constructor(status: number, code: string, serverMessage: string, details: ValidationDetail[] = [], requestId?: string) {
    const friendly = getUserFriendlyError(status, { code, message: serverMessage, details });
    super(friendly.message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
    this.serverMessage = serverMessage;
    this.friendly = friendly;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/** Anything thrown — ApiError, a render crash, a string — as something safe to show. */
export function describeError(error: unknown): FriendlyError {
  if (isApiError(error)) return error.friendly;
  if (error instanceof TypeError && /fetch|network/i.test(error.message)) return { ...NETWORK_ERROR };
  return { ...UNKNOWN_ERROR };
}

/**
 * Developer-facing detail for the browser console. Silent in production and in tests.
 *
 * Deliberately never `console.error`: Next.js turns every console.error into a
 * red dev overlay, and a wrong password or a 404 is expected behaviour the UI
 * already handles — not a crash. "info" for expected client errors (4xx),
 * "warn" for faults worth a look (5xx, network, render crashes).
 */
export function logDiagnostic(level: "info" | "warn", context: string, detail: Record<string, unknown> = {}) {
  if (process.env.NODE_ENV === "production" || process.env.NODE_ENV === "test") return;
  console[level](`[TimeFlow] ${context}`, detail);
}
