// Selectable platforms + regions for the admin "Add / Edit brand" dialogs.
//
// These MIRROR the customer app's canonical lists (src/lib/platforms.ts and
// src/lib/regions.ts). The admin app is a separate Vite build and can't import from the
// customer app, so we keep a small hand-synced copy of the VALUES that get stored on a brand:
//   * platform apiKeys  → brands.platforms
//   * country codes     → brands.target_regions
// Keep this in sync if the customer lists change.

export interface PlatformOption {
  apiKey: string; // stored on the brand (brands.platforms)
  label: string; // shown in the UI
  group: "shops" | "ads" | "other";
}

export const PLATFORM_GROUPS: { key: PlatformOption["group"]; label: string }[] = [
  { key: "shops", label: "Shops" },
  { key: "ads", label: "Ad platforms" },
  { key: "other", label: "Others" },
];

export const PLATFORM_OPTIONS: PlatformOption[] = [
  { apiKey: "amazon", label: "Amazon", group: "shops" },
  { apiKey: "ebay", label: "eBay", group: "shops" },
  { apiKey: "aliexpress", label: "AliExpress", group: "shops" },
  { apiKey: "alibaba", label: "Alibaba", group: "shops" },
  { apiKey: "shopify", label: "Shopify Network", group: "shops" },
  { apiKey: "etsy", label: "Etsy", group: "shops" },
  { apiKey: "facebook_marketplace", label: "FB Marketplace", group: "shops" },
  { apiKey: "google_ads", label: "Google", group: "ads" },
  { apiKey: "meta_ads", label: "Meta", group: "ads" },
  { apiKey: "domains", label: "Web Domain", group: "other" },
  { apiKey: "instagram", label: "Instagram", group: "other" },
  { apiKey: "tiktok", label: "TikTok", group: "other" },
];

export interface RegionCountry {
  code: string; // stored on the brand (brands.target_regions)
  name: string;
  flag: string;
}
export interface RegionGroup {
  key: string;
  label: string;
  countries: RegionCountry[];
}

export const REGION_GROUPS: RegionGroup[] = [
  {
    key: "NA",
    label: "North America",
    countries: [
      { code: "US", name: "United States", flag: "🇺🇸" },
      { code: "CA", name: "Canada", flag: "🇨🇦" },
    ],
  },
  {
    key: "EMEA",
    label: "Europe",
    countries: [
      { code: "DE", name: "Germany", flag: "🇩🇪" },
      { code: "FR", name: "France", flag: "🇫🇷" },
      { code: "GB", name: "United Kingdom", flag: "🇬🇧" },
    ],
  },
  {
    key: "APAC",
    label: "Asia-Pacific",
    countries: [
      { code: "AU", name: "Australia", flag: "🇦🇺" },
      { code: "SG", name: "Singapore", flag: "🇸🇬" },
      { code: "JP", name: "Japan", flag: "🇯🇵" },
    ],
  },
  {
    key: "LATAM",
    label: "Latin America",
    countries: [
      { code: "BR", name: "Brazil", flag: "🇧🇷" },
      { code: "MX", name: "Mexico", flag: "🇲🇽" },
    ],
  },
];

export const ALL_REGION_CODES: string[] = REGION_GROUPS.flatMap((g) => g.countries.map((c) => c.code));
export const PLATFORM_LABEL: Record<string, string> = Object.fromEntries(
  PLATFORM_OPTIONS.map((p) => [p.apiKey, p.label]),
);
