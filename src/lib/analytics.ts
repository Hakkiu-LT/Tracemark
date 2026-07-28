// GA4 custom event tracking — consent-aware.
//
// Every event goes through `trackEvent`, which fires ONLY when the visitor has
// granted analytics consent AND gtag.js is loaded. Without consent this is a
// silent no-op, so callers never need their own consent checks.

import { readConsent } from "./consent";

type EventParams = Record<
  string,
  string | number | boolean | string[] | undefined
>;

type Gtag = (...args: unknown[]) => void;

/**
 * Send a GA4 event, but only if the user consented to analytics.
 * Safe to call anywhere (SSR, pre-consent, GA-not-loaded) — it just does nothing.
 */
export function trackEvent(name: string, params?: EventParams): void {
  if (typeof window === "undefined") return;

  // Respect consent: no analytics permission → don't track.
  const consent = readConsent();
  if (!consent?.analytics) return;

  const gtag = (window as unknown as { gtag?: Gtag }).gtag;
  if (typeof gtag !== "function") return;

  gtag("event", name, params ?? {});
}

/**
 * Lead-generation conversion. Uses GA4's recommended `generate_lead` event so
 * it's recognised out of the box — mark it as a "key event" in the GA4 UI to
 * count it as a conversion.
 */
export function trackLead(params: { source: string; leadType: string }): void {
  trackEvent("generate_lead", {
    lead_source: params.source,
    lead_type: params.leadType,
  });
}
