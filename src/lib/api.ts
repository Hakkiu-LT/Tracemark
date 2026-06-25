import type { CheckBrandRequest, CheckBrandResponse } from "./api.types";
import { supabase } from "./supabase";

const BASE =
  typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL
    ? import.meta.env.VITE_API_URL
    : "http://localhost:8000/api/v1";

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const session = await supabase?.auth.getSession();
  const token = session?.data?.session?.access_token;

  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export function checkBrand(payload: CheckBrandRequest): Promise<CheckBrandResponse> {
  return apiFetch<CheckBrandResponse>("/check-brand", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function checkBrandFullPipeline(payload: CheckBrandRequest, signal?: AbortSignal): Promise<CheckBrandResponse> {
  return apiFetch<CheckBrandResponse>("/monitoring/check-brand", {
    method: "POST",
    body: JSON.stringify(payload),
    signal,
  });
}

export function updateCaseStatusBackend(caseId: string, status: string): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/monitoring/${caseId}/status`, {
    method: "POST",
    body: JSON.stringify({ status }),
  });
}

export interface InfringementFeedItem {
  id: string;
  case_id: string | null;
  platform: string;
  source_url: string;
  risk_level: "HIGH" | "MEDIUM" | "LOW";
  match_score: number;
  match_type: string;
  status: string;
  screenshot_url: string | null;
  flagged_at: string;
  created_at: string;
}

export interface InfringementsResponse {
  items: InfringementFeedItem[];
  total: number;
}

export function getInfringements(params?: {
  risk_level?: string;
  status?: string;
  platform?: string;
  limit?: number;
  offset?: number;
}): Promise<InfringementsResponse> {
  const query = new URLSearchParams(
    Object.fromEntries(
      Object.entries(params ?? {})
        .filter(([, v]) => v !== undefined && v !== null && v !== "")
        .map(([k, v]) => [k, String(v)])
    )
  ).toString();
  return apiFetch<InfringementsResponse>(`/infringements${query ? `?${query}` : ""}`);
}

