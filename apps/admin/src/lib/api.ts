import { supabase } from "./supabase";

const BASE =
  (import.meta.env.VITE_ADMIN_API_URL as string | undefined) ??
  "http://localhost:8001/api/v1";

/**
 * Error thrown by {@link adminFetch} on a non-2xx response. Carries the HTTP
 * `status` so the UI (`<ErrorState>`) can show the matching illustration
 * (1xx…5xx). A request that never reaches the server throws a plain `TypeError`
 * from `fetch`, which is treated as "signal lost" downstream.
 */
export class AdminApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "AdminApiError";
    this.status = status;
  }
}

/** Fetch the admin-api, injecting the staff Supabase JWT as a Bearer token. */
export async function adminFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const isFormData = typeof FormData !== "undefined" && init.body instanceof FormData;
  const headers: Record<string, string> = {
    // Let the browser set multipart boundaries for FormData uploads.
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(init.headers as Record<string, string> | undefined),
  };
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }

  const resp = await fetch(`${BASE}${path}`, { ...init, headers });
  if (!resp.ok) {
    let detail = `Request failed (${resp.status})`;
    try {
      const body = await resp.json();
      detail = body.detail ?? detail;
    } catch {
      /* non-JSON error body */
    }
    // Carry the HTTP status so the UI can show the matching error image.
    throw new AdminApiError(resp.status, detail);
  }
  // 204 / empty body tolerance
  const text = await resp.text();
  return (text ? JSON.parse(text) : undefined) as T;
}
