import type { CheckBrandRequest, CheckBrandResponse } from "./api.types";

const BASE =
  typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL
    ? import.meta.env.VITE_API_URL
    : "http://localhost:8000/api/v1";

/**
 * Error thrown by {@link apiFetch} when the server responds with a non-2xx
 * status. Unlike a plain `Error`, it carries the HTTP `status` code so the UI
 * can pick the right error illustration (1xx…5xx) via `getErrorStatus`.
 *
 * When the request never reaches the server (offline, DNS/TLS failure, aborted),
 * `fetch` itself throws a `TypeError` — that stays a plain error and is treated
 * as "signal lost" downstream (no status).
 */
export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  // Lazy-import the Supabase client so @supabase/* is NOT pulled into the shared
  // entry chunk via this widely-imported module. Module-cached after first call.
  const { supabase } = await import("./supabase");
  const session = await supabase?.auth.getSession();
  const token = session?.data?.session?.access_token;

  const isFormData = init.body instanceof FormData;
  const headers: Record<string, string> = {};
  if (!isFormData) {
    headers["Content-Type"] = "application/json";
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  Object.assign(headers, (init.headers as Record<string, string>) || {});

  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    // FastAPI returns {"detail": "..."} — surface that clean message to the user.
    let message = text;
    try {
      const parsed = JSON.parse(text);
      if (parsed?.detail) {
        message = typeof parsed.detail === "string" ? parsed.detail : JSON.stringify(parsed.detail);
      }
    } catch {
      /* not JSON — keep raw text */
    }
    // Carry the HTTP status so the UI can show the matching error image.
    throw new ApiError(res.status, message || `API ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function checkBrandFullPipeline(
  payload: CheckBrandRequest,
  signal?: AbortSignal,
): Promise<CheckBrandResponse> {
  return apiFetch<CheckBrandResponse>("/monitoring/check-brand", {
    method: "POST",
    body: JSON.stringify(payload),
    signal,
  });
}

export function updateCaseStatusBackend(
  caseId: string,
  status: string,
  declineReason?: string,
): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/monitoring/${caseId}/status`, {
    method: "POST",
    body: JSON.stringify({ status, decline_reason: declineReason }),
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
  updated_at?: string | null;
  brand_name?: string | null;
  client_id?: string | null;
  case_status?: string | null;
  case_updated_at?: string;
  detection_region?: string | null;
}

export interface InfringementsResponse {
  items: InfringementFeedItem[];
  total: number;
}

export function getInfringements(params?: {
  risk_level?: string;
  status?: string;
  platform?: string;
  client_id?: string;
  limit?: number;
  offset?: number;
}): Promise<InfringementsResponse> {
  const query = new URLSearchParams(
    Object.fromEntries(
      Object.entries(params ?? {})
        .filter(([, v]) => v !== undefined && v !== null && v !== "")
        .map(([k, v]) => [k, String(v)]),
    ),
  ).toString();
  return apiFetch<InfringementsResponse>(`/infringements${query ? `?${query}` : ""}`);
}

export function getInfringementById(id: string): Promise<InfringementFeedItem> {
  return apiFetch<InfringementFeedItem>(`/infringements/${id}`);
}

export interface EvidenceItem {
  id: string;
  infringement_id: string;
  screenshot_url: string | null;
  ai_analysis: Record<string, any> | null;
  captured_at: string;
  created_at: string;
}

export function getInfringementEvidence(id: string): Promise<EvidenceItem[]> {
  return apiFetch<EvidenceItem[]>(`/infringements/${id}/evidence`);
}

export function updateInfringementStatus(
  id: string,
  status: string,
  declineReason?: string,
): Promise<InfringementFeedItem> {
  return apiFetch<InfringementFeedItem>(`/infringements/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status, decline_reason: declineReason }),
  });
}

export function updateTakedownReport(
  id: string,
  data: { notice_text?: string; status?: string },
): Promise<any> {
  return apiFetch<any>(`/monitoring/takedowns/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function sendTakedownEmail(
  id: string,
): Promise<{ success: boolean; message: string; submitted_at: string }> {
  return apiFetch<{ success: boolean; message: string; submitted_at: string }>(
    `/monitoring/takedowns/${id}/send-email`,
    {
      method: "POST",
    },
  );
}

export function testEmailNotification(
  email?: string,
): Promise<{ success: boolean; message: string }> {
  // Omit the email entirely when blank so the backend falls back to the
  // caller's account address instead of rejecting an empty string (EmailStr).
  const body = email && email.trim() ? { email: email.trim() } : {};
  return apiFetch<{ success: boolean; message: string }>("/monitoring/notifications/test/email", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// ── Brands (server-persisted monitored brands) ───────────────────────────────

export interface BrandRecord {
  id: string;
  organization_id: string;
  client_id: string | null;
  brand_name: string;
  website: string | null;
  registration_number: string | null;
  platforms: string[];
  target_regions: string[];
  logo_color: string | null;
  official_domains: string[] | null;
  official_advertisers: string[] | null;
  status: "active" | "locked" | "on_hold";
  last_scan_at: string | null;
  created_at: string;
}

export interface BrandAsset {
  id: string;
  brand_id: string;
  asset_type: "logo" | "reference_content" | "product_image";
  file_url: string | null;
  content_hash: string | null;
  phash: number | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

// Plan limits for the caller's org.
export interface PlanLimits {
  brands: number | null; // org-total number of brands (monitored assets); null = unlimited
  allowed_platforms: string[] | null; // whitelist of marketplace apiKeys; null = all allowed
  allowed_regions: string[] | null; // whitelist of region country codes; null = all allowed
}

export interface BrandsResponse {
  brands: BrandRecord[];
  usage: { used: number; limit: number | null };
  limits: PlanLimits;
}

export function getBrands(): Promise<BrandsResponse> {
  return apiFetch<BrandsResponse>("/brands");
}

/** One company the caller belongs to. `is_active` marks the org the API currently scopes to. */
export interface OrgSummary {
  id: string;
  name: string;
  role: string;
  is_active: boolean;
}
export interface MyOrganizationsResponse {
  organizations: OrgSummary[];
  active_organization_id: string;
}

/** Companies the logged-in user is a member of (excludes the internal staff org). */
export function getMyOrganizations(): Promise<MyOrganizationsResponse> {
  return apiFetch<MyOrganizationsResponse>("/organizations/mine");
}

/** Repoint the caller's active company. Server re-checks membership. */
export function switchOrganization(
  organizationId: string,
): Promise<{ active_organization_id: string }> {
  return apiFetch("/organizations/switch", {
    method: "POST",
    body: JSON.stringify({ organization_id: organizationId }),
  });
}

/** Create a server-persisted monitored brand. */
export function createBrand(payload: {
  brand_name: string;
  website?: string | null;
  registration_number?: string | null;
  platforms?: string[];
  target_regions?: string[];
  logo_color?: string | null;
  client_id?: string | null;
  official_domains?: string[];
  official_advertisers?: string[];
}): Promise<BrandRecord> {
  return apiFetch<BrandRecord>("/brands", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateBrand(
  id: string,
  updates: Partial<{
    brand_name: string;
    website: string | null;
    registration_number: string | null;
    platforms: string[];
    target_regions: string[];
    logo_color: string | null;
    status: "active" | "locked" | "on_hold";
    official_domains: string[];
    official_advertisers: string[];
  }>,
): Promise<BrandRecord> {
  return apiFetch<BrandRecord>(`/brands/${id}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

export function deleteBrand(id: string): Promise<{ deleted: boolean; id: string }> {
  return apiFetch(`/brands/${id}`, { method: "DELETE" });
}

export function listBrandAssets(brandId: string): Promise<BrandAsset[]> {
  return apiFetch<BrandAsset[]>(`/brands/${brandId}/assets`);
}

export async function uploadBrandAsset(
  brandId: string,
  assetType: "logo" | "reference_content" | "product_image",
  file: File,
): Promise<BrandAsset> {
  const formData = new FormData();
  formData.append("asset_type", assetType);
  formData.append("file", file);
  const res = await apiFetch<BrandAsset>(`/brands/${brandId}/assets`, {
    method: "POST",
    body: formData,
  });
  return res;
}

export function deleteBrandAsset(
  brandId: string,
  assetId: string,
): Promise<{ deleted: boolean; id: string }> {
  return apiFetch(`/brands/${brandId}/assets/${assetId}`, { method: "DELETE" });
}

export function refreshReferenceContent(
  brandId: string,
): Promise<{ refreshed: boolean; source_urls?: string[]; last_fetched?: string; text_length?: number; message?: string }> {
  return apiFetch(`/brands/${brandId}/reference-content/refresh`, { method: "POST" });
}
