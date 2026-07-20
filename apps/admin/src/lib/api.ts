import { supabase } from "./supabase";

const BASE =
  (import.meta.env.VITE_ADMIN_API_URL as string | undefined) ??
  "http://localhost:8001/api/v1";

/** Fetch the admin-api, injecting the staff Supabase JWT as a Bearer token. */
export async function adminFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
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
    throw new Error(detail);
  }
  // 204 / empty body tolerance
  const text = await resp.text();
  return (text ? JSON.parse(text) : undefined) as T;
}
