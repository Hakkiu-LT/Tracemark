import type { CheckBrandRequest, CheckBrandResponse } from "./api.types";

const BASE =
  typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL
    ? import.meta.env.VITE_API_URL
    : "http://localhost:8000/api/v1";

export async function apiFetch<T>(path: string, init: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init.headers },
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

export function checkBrandFullPipeline(payload: CheckBrandRequest): Promise<CheckBrandResponse> {
  return apiFetch<CheckBrandResponse>("/monitoring/check-brand", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
