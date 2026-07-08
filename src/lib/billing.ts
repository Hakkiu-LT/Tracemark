/**
 * Shared billing metadata for the frontend (display only).
 *
 * Prices here are for rendering plan/add-on cards. The amount actually charged
 * always comes from Stripe (via the backend Price IDs) — never trust these
 * numbers for money movement, only for showing the user what to expect.
 */

export type PlanId = "free" | "starter" | "growth" | "pro" | "agency" | "enterprise";
export type BillingInterval = "month" | "year";
export type PlanAudience = "brand_owner" | "law_firm" | "both";

export interface PlanMeta {
  id: PlanId;
  name: string;
  /** Monthly price in USD, or null for custom/contact-sales plans. */
  monthly: number | null;
  blurb: string;
  features: string[];
  audience: PlanAudience;
  highlight?: boolean;
  /** Plans that can be purchased self-serve via Stripe checkout. */
  selfServe: boolean;
}

/**
 * Yearly billing gives ~2 months free: yearly total = monthly * 10.
 * We show the *effective monthly* price when billed yearly.
 */
export const YEARLY_MONTHS_CHARGED = 10;

export const PLANS: PlanMeta[] = [
  {
    id: "starter",
    name: "Starter",
    monthly: 99,
    blurb: "For founders protecting a single brand.",
    features: [
      "1 brand",
      "3 platforms",
      "Weekly scans",
      "Assisted takedown notices",
      "Email support",
    ],
    audience: "brand_owner",
    selfServe: true,
  },
  {
    id: "growth",
    name: "Growth",
    monthly: 249,
    blurb: "For scaling e-commerce and SaaS teams.",
    features: [
      "5 brands",
      "All 13 platforms",
      "Daily scans",
      "Auto takedown generation",
      "Priority support",
    ],
    audience: "brand_owner",
    highlight: true,
    selfServe: true,
  },
  {
    id: "pro",
    name: "Pro",
    monthly: 599,
    blurb: "Real-time protection with domain tracking.",
    features: [
      "20 brands",
      "All platforms + domain tracking",
      "Real-time monitoring",
      "Auto-generated DMCA & Cease-and-Desist docs",
      "Dedicated account manager",
    ],
    audience: "brand_owner",
    selfServe: true,
  },
  {
    id: "agency",
    name: "Agency",
    monthly: 1499,
    blurb: "White-label multi-client workspace for agencies & law firms.",
    features: [
      "Unlimited brands",
      "White-label reports",
      "Full API access",
      "Multi-client dashboard",
      "SLA + dedicated support",
    ],
    audience: "law_firm",
    highlight: true,
    selfServe: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    monthly: null,
    blurb: "Managed service for large corporations. Custom pricing.",
    features: [
      "Managed takedown service (we do the work)",
      "Court-ready evidence & legal integration",
      "Dedicated scraping infrastructure",
      "Custom integrations (Salesforce, SAP, SSO/SAML)",
      "99.9% SLA · SOC 2 · GDPR / EU data residency",
    ],
    audience: "both",
    selfServe: false,
  },
];

export interface AddonMeta {
  key: string;
  name: string;
  /** Price in USD per unit per month. */
  price: number;
  /** Label for what one unit represents, e.g. "region", "50 domains". */
  unit: string;
  description: string;
  /** Per-unit quantity add-on vs a flat single-quantity add-on. */
  perUnit: boolean;
  /**
   * Standard subscription add-ons flow through checkout in v1.
   * Usage-based add-ons (managed takedown, API overage) are handled separately.
   */
  usageBased?: boolean;
}

export const ADDONS: AddonMeta[] = [
  {
    key: "addon_region",
    name: "Additional regions",
    price: 49,
    unit: "region",
    description:
      "Scan marketplaces & search results in specific countries, with localized language detection.",
    perUnit: true,
  },
  {
    key: "addon_domains",
    name: "Domain tracking",
    price: 29,
    unit: "50 domains",
    description: "WHOIS monitoring for typosquatting and new domain registration alerts.",
    perUnit: true,
  },
  {
    key: "addon_reports",
    name: "Advanced reports",
    price: 79,
    unit: "workspace",
    description:
      "Custom branded PDF reports, scheduled reporting, and executive summary dashboards.",
    perUnit: false,
  },
  {
    key: "addon_brand",
    name: "Extra brands",
    price: 19,
    unit: "brand",
    description: "Add brands beyond your plan limit.",
    perUnit: true,
  },
];

/** Add-ons purchasable through the self-serve checkout flow (v1). */
export const SUBSCRIPTION_ADDON_KEYS = ADDONS.filter((a) => !a.usageBased).map((a) => a.key);

export function getPlan(id: string): PlanMeta | undefined {
  return PLANS.find((p) => p.id === id);
}

export function getAddon(key: string): AddonMeta | undefined {
  return ADDONS.find((a) => a.key === key);
}

/** Effective monthly price for an interval (yearly = ~2 months free). */
export function effectiveMonthly(monthly: number, interval: BillingInterval): number {
  if (interval === "year") return Math.round((monthly * YEARLY_MONTHS_CHARGED) / 12);
  return monthly;
}

/** Total amount billed up front for the chosen interval. */
export function intervalTotal(monthly: number, interval: BillingInterval): number {
  return interval === "year" ? monthly * YEARLY_MONTHS_CHARGED : monthly;
}
