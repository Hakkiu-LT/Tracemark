import type { CheckBrandRequest, CheckBrandResponse } from "./api.types";
import { supabase } from "./supabase";

const BASE =
  typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL
    ? import.meta.env.VITE_API_URL
    : "http://localhost:8000/api/v1";

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
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
    throw new Error(message || `API ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function checkBrand(payload: CheckBrandRequest): Promise<CheckBrandResponse> {
  return apiFetch<CheckBrandResponse>("/check-brand", {
    method: "POST",
    body: JSON.stringify(payload),
  });
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
  email: string,
): Promise<{ success: boolean; message: string }> {
  return apiFetch<{ success: boolean; message: string }>("/monitoring/notifications/test/email", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

// ── Billing ──────────────────────────────────────────────────────────────────

export interface AddonSelection {
  key: string;
  quantity: number;
}

export interface SubscriptionInfo {
  plan: string;
  status: string;
  interval?: "month" | "year";
  current_period_end?: string | null;
  cancel_at_period_end?: boolean;
  addons: AddonSelection[];
}

export interface InvoiceRecord {
  id: string;
  stripe_invoice_id: string | null;
  amount_due: number;
  currency: string;
  status: string;
  hosted_invoice_url: string | null;
  invoice_pdf: string | null;
  created_at: string;
}

/** Start a subscription and get back the PaymentIntent client_secret for Elements. */
export function createSubscription(payload: {
  plan: string;
  interval: "month" | "year";
  addons?: AddonSelection[];
}): Promise<{ subscription_id: string; client_secret: string }> {
  return apiFetch("/billing/create-subscription", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** Change plan/interval or reconcile add-on quantities on the active subscription. */
export function updateSubscription(payload: {
  plan?: string;
  interval?: "month" | "year";
  addons?: AddonSelection[];
}): Promise<{ status: string; plan: string; interval: string }> {
  return apiFetch("/billing/update-subscription", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** Guest checkout: start a subscription without auth; user creates account after payment. */
export function guestSubscribe(payload: {
  email: string;
  plan: string;
  interval: "month" | "year";
  addons?: AddonSelection[];
}): Promise<{ subscription_id: string; client_secret: string }> {
  return apiFetch("/billing/guest-subscribe", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** After the guest creates their Supabase account, bind the subscription to their profile. */
export function activateSubscription(payload: {
  stripe_subscription_id: string;
}): Promise<{ status: string }> {
  return apiFetch("/billing/activate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function cancelSubscription(cancel: boolean): Promise<{ cancel_at_period_end: boolean }> {
  return apiFetch("/billing/cancel-subscription", {
    method: "POST",
    body: JSON.stringify({ cancel }),
  });
}

export function getSubscription(): Promise<SubscriptionInfo> {
  return apiFetch<SubscriptionInfo>("/billing/subscription");
}

export function getInvoices(): Promise<InvoiceRecord[]> {
  return apiFetch<InvoiceRecord[]>("/billing/invoices");
}

/** Open the Stripe Billing Portal (manage payment method / cancel externally). */
export function createPortalSession(): Promise<{ url: string }> {
  return apiFetch("/billing/create-portal-session", { method: "POST" });
}

/** Phase F: bill a one-off $500 fee for a successful managed takedown. */
export function chargeManagedTakedown(takedownId?: string): Promise<{ invoice_item_id: string }> {
  return apiFetch("/billing/charge-managed-takedown", {
    method: "POST",
    body: JSON.stringify({ takedown_id: takedownId ?? null }),
  });
}

// ── Brands (server-persisted monitored brands, with plan-limit enforcement) ───

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

export interface BrandsResponse {
  brands: BrandRecord[];
  usage: { used: number; limit: number | null };
}

export function getBrands(): Promise<BrandsResponse> {
  return apiFetch<BrandsResponse>("/brands");
}

/** Create a server brand. Throws (402) with an upsell message when the plan's
 * brand limit is reached — surface the error to the user. */
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
