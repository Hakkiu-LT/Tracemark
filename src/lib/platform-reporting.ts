/**
 * Platform IP-reporting directory — where to submit a takedown for each
 * platform. Mirrors the backend `PLATFORM_REGISTRY` in
 * `apps/api/src/tracemark_api/services/takedown.py` (keep the two in sync) so
 * the per-copycat takedown page can deep-link the official reporting channel
 * without a backend round-trip.
 */

export interface PlatformReporting {
  /** Official reporting / abuse form, when the platform offers one. */
  url?: string;
  /** Abuse contact email, when reporting happens by email. */
  email?: string;
  /** How the notice gets submitted. */
  method: "web_form" | "email" | "udrp";
}

const REGISTRY: Record<string, PlatformReporting> = {
  // Marketplaces
  amazon: { url: "https://www.amazon.com/report/infringement", method: "web_form" },
  ebay: { url: "https://contact.ebay.com/ws/eBayISAPI.dll?ReportIPInfringement", method: "web_form" },
  etsy: { url: "https://www.etsy.com/report-infringement", method: "web_form" },
  alibaba: { url: "https://ipp.aidcgroup.net", method: "web_form" },
  aliexpress: { url: "https://ipp.aidcgroup.net/complaint/onlineForm/online.htm", method: "web_form" },
  shopify: { url: "https://www.shopify.com/legal/trademark", method: "web_form" },
  walmart: { url: "https://www.walmart.com/help/article/report-intellectual-property-infringement/819fb2fcbf7843e2919706cafc10ef00", method: "web_form" },
  wish: { url: "https://www.wish.com/legal/ip-policy", method: "web_form" },
  temu: { url: "https://www.temu.com/ip-infringement-report.html", method: "web_form" },
  redbubble: { url: "https://www.redbubble.com/dmca/report", method: "web_form" },
  // Social media
  instagram: { url: "https://help.instagram.com/contact/230197320740525", method: "web_form" },
  facebook: { url: "https://www.facebook.com/help/contact/trademarkform", method: "web_form" },
  tiktok: { url: "https://www.tiktok.com/legal/report/Copyright", method: "web_form" },
  youtube: { url: "https://www.youtube.com/copyright_complaint_form", method: "web_form" },
  twitter: { url: "https://help.twitter.com/forms/dmca", method: "web_form" },
  pinterest: { url: "https://www.pinterest.com/about/copyright/dmca-pin/", method: "web_form" },
  linkedin: { url: "https://www.linkedin.com/help/linkedin/ask/TS-NTCR", method: "web_form" },
  reddit: { email: "copyright@reddit.com", method: "email" },
  snapchat: { url: "https://support.snapchat.com/a/report-copyright", method: "web_form" },
  twitch: { url: "https://www.twitch.tv/p/en/legal/dmca-guidelines/", method: "web_form" },
  discord: { email: "copyright@discord.com", method: "email" },
  tumblr: { url: "https://www.tumblr.com/dmca", method: "web_form" },
  // Search engines
  google_search: { url: "https://reportcontent.google.com/forms/dmca_search", method: "web_form" },
  google_images: { url: "https://reportcontent.google.com/forms/dmca_image", method: "web_form" },
  bing: { url: "https://www.bing.com/webmaster/tools/contentremoval", email: "dmca@microsoft.com", method: "web_form" },
  // Ad platforms
  google_ads: { url: "https://support.google.com/adspolicy/troubleshooter/4578507", email: "trademark@google.com", method: "web_form" },
  meta_ads: { url: "https://www.facebook.com/help/contact/trademarkform", method: "web_form" },
  tiktok_ads: { url: "https://ads.tiktok.com/help/article/ad-intellectual-property-policy", method: "web_form" },
  // Domain registrars / hosting
  cloudflare: { url: "https://abuse.cloudflare.com/dmca", method: "web_form" },
  godaddy: { url: "https://supportcenter.godaddy.com/ipclaims", method: "web_form" },
  namecheap: { email: "abuse@namecheap.com", method: "email" },
  dreamhost: { url: "https://www.dreamhost.com/legal/dmca/", method: "web_form" },
  bluehost: { email: "dmca@bluehost.com", method: "email" },
  udrp_icann: { url: "https://www.icann.org/resources/pages/help/dndr/udrp-en", method: "udrp" },
  udrp_wipo: { url: "https://www.wipo.int/amc/en/domains/", method: "udrp" },
  // Other
  github: { url: "https://github.com/contact/dmca", method: "web_form" },
  vimeo: { url: "https://vimeo.com/dmca", method: "web_form" },
  wordpress: { url: "https://en.support.wordpress.com/report-blogs/", method: "web_form" },
};

/** Aliases for raw platform strings the scanners/AI actually return. */
const ALIASES: Record<string, string> = {
  ali_express: "aliexpress",
  facebook_marketplace: "facebook",
  facebook_ads: "meta_ads",
  instagram_ads: "meta_ads",
  meta: "meta_ads",
  google: "google_search",
  x: "twitter",
  x_com: "twitter",
  wordpress_com: "wordpress",
  // Domain detections are registrar-dependent — point at the ICANN UDRP
  // procedure as the universal channel.
  domains: "udrp_icann",
  web_domain: "udrp_icann",
  domain: "udrp_icann",
};

/**
 * Resolve the reporting channel for an infringement's platform.
 * Normalizes raw values like "Meta Ads" / "Facebook Marketplace" / "web_domain".
 * Returns null when no channel is known for the platform.
 */
export function getPlatformReporting(platform: string | null | undefined): PlatformReporting | null {
  if (!platform) return null;
  const key = platform.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const resolved = ALIASES[key] ?? key;
  return REGISTRY[resolved] ?? null;
}
