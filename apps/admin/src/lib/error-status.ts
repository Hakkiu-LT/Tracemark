/**
 * Maps any thrown error to an HTTP-status "bucket" so the UI can show a
 * matching illustration. Buckets: 1xx…5xx, plus "signal-lost" when the request
 * never got a response from the server (offline / DNS / TLS / aborted / timeout).
 *
 * The important idea: a *bucket* (e.g. "4xx") chooses the IMAGE, while the exact
 * status number (e.g. 404) is shown as text next to it.
 */

export type ErrorBucket = "1xx" | "2xx" | "3xx" | "4xx" | "5xx" | "signal-lost";

/** Substrings that indicate the request never reached the server. */
const NETWORK_PATTERNS = [
  "failed to fetch", // Chrome
  "load failed", // Safari
  "networkerror", // Firefox
  "network request failed",
  "err_network",
  "err_internet_disconnected",
  "err_connection",
  "econnrefused",
  "enotfound",
  "etimedout",
  "timeout",
  "timed out",
  "aborted",
  "the operation was aborted",
];

/**
 * Extract the HTTP status code from any error shape we might throw:
 *  - `ApiError` (our fetch wrapper) → `.status`
 *  - fetch `Response`-like objects → `.status` / `.statusCode`
 *  - Supabase / PostgREST errors → numeric `.status`, else numeric `.code`
 *
 * Returns `null` when there is no usable status — meaning either a genuine
 * connection failure ("signal lost") or an unknown error we treat as such.
 */
export function getErrorStatus(error: unknown): number | null {
  if (error == null) return null;

  // A bare number was passed (e.g. res.status).
  if (typeof error === "number") {
    return isValidHttpStatus(error) ? error : null;
  }

  if (typeof error === "object") {
    const e = error as Record<string, unknown>;

    // Common status fields across fetch/axios/supabase style errors.
    for (const key of ["status", "statusCode", "httpStatus"]) {
      const v = e[key];
      if (typeof v === "number" && isValidHttpStatus(v)) return v;
      if (typeof v === "string" && isValidHttpStatus(Number(v))) return Number(v);
    }

    // PostgREST sometimes surfaces the HTTP code in `code` as a numeric string.
    const code = e.code;
    if (typeof code === "number" && isValidHttpStatus(code)) return code;
    if (typeof code === "string" && /^\d{3}$/.test(code) && isValidHttpStatus(Number(code))) {
      return Number(code);
    }
  }

  // No structured status → inspect the message for a network-failure signature.
  const message = getMessage(error).toLowerCase();
  if (NETWORK_PATTERNS.some((p) => message.includes(p))) return null;

  // As a last resort, look for a "... 503" / "API 500" style code in the text.
  const match = message.match(/\b([1-5]\d{2})\b/);
  if (match) return Number(match[1]);

  return null;
}

/**
 * Resolve the illustration bucket for an error. `null`/unknown status →
 * "signal-lost", otherwise the leading digit picks 1xx…5xx.
 */
export function getErrorBucket(status: number | null): ErrorBucket {
  if (status == null) return "signal-lost";
  const leading = Math.floor(status / 100);
  switch (leading) {
    case 1:
      return "1xx";
    case 2:
      return "2xx";
    case 3:
      return "3xx";
    case 4:
      return "4xx";
    case 5:
      return "5xx";
    default:
      return "signal-lost";
  }
}

/** Human-readable message for an error of unknown shape. */
export function getMessage(error: unknown): string {
  if (error == null) return "";
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (typeof error === "object") {
    const e = error as Record<string, unknown>;
    if (typeof e.message === "string") return e.message;
    if (typeof e.detail === "string") return e.detail;
    if (typeof e.error === "string") return e.error;
  }
  return String(error);
}

function isValidHttpStatus(n: number): boolean {
  return Number.isFinite(n) && n >= 100 && n <= 599;
}
