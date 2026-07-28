// Central mapping from a platform string (in ANY form the app uses — display
// label like "Meta Ads", store id like "Facebook Marketplace", or API key like
// "meta_ads"/"facebook_marketplace"/"google_ads"/"domains") to its real logo PNG.
//
// Logos are generated brand marks (see src/images/platforms/). Import them so
// Vite fingerprints + bundles each asset and returns a URL string.
import amazon from "@/images/platforms/amazon.png";
import ebay from "@/images/platforms/ebay.png";
import aliexpress from "@/images/platforms/aliexpress.png";
import alibaba from "@/images/platforms/alibaba.png";
import shopify from "@/images/platforms/shopify.png";
import etsy from "@/images/platforms/etsy.png";
import facebookMarketplace from "@/images/platforms/facebook-marketplace.png";
import google from "@/images/platforms/google.png";
import meta from "@/images/platforms/meta.png";
import instagram from "@/images/platforms/instagram.png";
import tiktok from "@/images/platforms/tiktok.png";
import webDomain from "@/images/platforms/web-domain.png";

// Ordered keyword → logo rules. Order matters: more specific keywords first so
// e.g. "facebook marketplace" resolves before a bare "meta"/"facebook" would,
// and "aliexpress" before "alibaba".
const RULES: { match: string[]; logo: string }[] = [
  { match: ["amazon"], logo: amazon },
  { match: ["aliexpress"], logo: aliexpress },
  { match: ["alibaba"], logo: alibaba },
  { match: ["ebay"], logo: ebay },
  { match: ["etsy"], logo: etsy },
  { match: ["shopify"], logo: shopify },
  { match: ["instagram"], logo: instagram },
  { match: ["tiktok"], logo: tiktok },
  { match: ["facebookmarketplace", "fbmarketplace", "marketplace", "facebook"], logo: facebookMarketplace },
  { match: ["meta"], logo: meta },
  { match: ["googleads", "google"], logo: google },
  { match: ["webdomain", "domain", "whois"], logo: webDomain },
];

/**
 * Resolve a platform string to its logo URL. Normalizes by lowercasing and
 * stripping every non-alphanumeric character, so "Meta Ads", "meta_ads" and
 * "meta" all collapse to "metaads"/"meta" and match the same rule.
 * Returns null when nothing matches (caller shows a letter fallback).
 */
export function getPlatformLogo(platform: string | null | undefined): string | null {
  if (!platform) return null;
  const norm = platform.toLowerCase().replace(/[^a-z0-9]/g, "");
  for (const rule of RULES) {
    if (rule.match.some((k) => norm.includes(k))) return rule.logo;
  }
  return null;
}
