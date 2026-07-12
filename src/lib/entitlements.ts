/**
 * Frontend mirror of the backend plan entitlements
 * (apps/api/src/tracemark_api/services/entitlements.py).
 *
 * This drives UX only — usage meters, disabled buttons, "Upgrade to unlock"
 * hints. The BACKEND is the authority: every limit is re-checked server-side, so
 * a tampered client can never actually exceed a plan. Keep the numbers here in
 * sync with the Python map.
 *
 * `null` for a numeric limit means "unlimited".
 */
import type { SubscriptionInfo } from "./api";

export interface Entitlement {
  brands: number | null;
  platforms: number | null;
  regions: number | null;
  domainTracking: boolean;
  managedTakedown: boolean;
  apiAccess: boolean;
  advancedReports: boolean;
  realTimeScans: boolean;
}

export const PLAN_ENTITLEMENTS: Record<string, Entitlement> = {
  free: {
    brands: 1,
    platforms: 1,
    regions: 1,
    domainTracking: false,
    managedTakedown: false,
    apiAccess: false,
    advancedReports: false,
    realTimeScans: false,
  },
  starter: {
    brands: 1,
    platforms: 3,
    regions: 1,
    domainTracking: false,
    managedTakedown: false,
    apiAccess: false,
    advancedReports: false,
    realTimeScans: false,
  },
  growth: {
    brands: 5,
    platforms: 13,
    regions: 3,
    domainTracking: false,
    managedTakedown: false,
    apiAccess: false,
    advancedReports: false,
    realTimeScans: false,
  },
  pro: {
    brands: 20,
    platforms: 13,
    regions: 10,
    domainTracking: true,
    managedTakedown: true,
    apiAccess: false,
    advancedReports: false,
    realTimeScans: true,
  },
  agency: {
    brands: null,
    platforms: 13,
    regions: null,
    domainTracking: true,
    managedTakedown: true,
    apiAccess: true,
    advancedReports: true,
    realTimeScans: true,
  },
  enterprise: {
    brands: null,
    platforms: 13,
    regions: null,
    domainTracking: true,
    managedTakedown: true,
    apiAccess: true,
    advancedReports: true,
    realTimeScans: true,
  },
};

const _ADDON_BRAND = "addon_brand";
const _ADDON_REGION = "addon_region";
const _ADDON_DOMAINS = "addon_domains";
const _ADDON_REPORTS = "addon_reports";

export function baseEntitlement(plan: string | null | undefined): Entitlement {
  return PLAN_ENTITLEMENTS[plan ?? "free"] ?? PLAN_ENTITLEMENTS.free;
}

/**
 * Effective entitlements = plan base + purchased add-ons. Pass the
 * `SubscriptionInfo` returned by `getSubscription()`.
 */
export function computeEntitlements(sub?: SubscriptionInfo | null): Entitlement {
  const ent = { ...baseEntitlement(sub?.plan) };
  const qty: Record<string, number> = {};
  for (const a of sub?.addons ?? []) {
    qty[a.key] = (qty[a.key] ?? 0) + (a.quantity ?? 0);
  }
  if (ent.brands !== null && qty[_ADDON_BRAND]) ent.brands += qty[_ADDON_BRAND];
  if (ent.regions !== null && qty[_ADDON_REGION]) ent.regions += qty[_ADDON_REGION];
  if (qty[_ADDON_DOMAINS]) ent.domainTracking = true;
  if (qty[_ADDON_REPORTS]) ent.advancedReports = true;
  return ent;
}

export function isUnlimited(limit: number | null): boolean {
  return limit === null;
}

export function formatLimit(limit: number | null): string {
  return limit === null ? "Unlimited" : String(limit);
}

/** True when the count is at/over the cap (unlimited never reached). */
export function limitReached(limit: number | null, count: number): boolean {
  return limit !== null && count >= limit;
}
