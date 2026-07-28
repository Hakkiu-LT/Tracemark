// Cookie-consent + Google Consent Mode v2 helpers (client-side).
//
// Strategy = "Basic" Consent Mode: gtag.js is NOT loaded until the user grants
// analytics consent. The <head> only sets `gtag('consent','default', …)` with
// everything denied, so ZERO Google network calls happen before consent — the
// safest posture under the EU ePrivacy Directive (prior-consent rule).
//
// This module is isomorphic-safe: every function guards `typeof window`.

/** localStorage key holding the visitor's choice. */
export const CONSENT_STORAGE_KEY = "hakkiu_cookie_consent";

/**
 * Bump this when the cookie policy materially changes — a stored choice with an
 * older version is treated as "no choice", so returning visitors are re-asked.
 */
export const CONSENT_POLICY_VERSION = 1;

/** GA4 measurement ID — env-driven with a fallback to the live property. */
export const GA_MEASUREMENT_ID =
  (import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined) || "G-PH8369N5PD";

/** Window event other components dispatch to re-open the cookie banner. */
export const OPEN_COOKIE_SETTINGS_EVENT = "hakkiu:open-cookie-settings";

/** The stored consent record — doubles as our proof-of-consent log. */
export type ConsentChoice = {
  analytics: boolean;
  /** epoch ms when the choice was made */
  ts: number;
  /** policy version the choice was made against */
  version: number;
};

/**
 * EEA + UK — the countries where prior consent for analytics cookies is legally
 * required. Visitors here see the banner; everyone else gets analytics enabled
 * automatically (consent not legally required). ISO 3166-1 alpha-2 codes.
 */
export const CONSENT_REQUIRED_COUNTRIES = new Set<string>([
  // EU 27
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR",
  "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK",
  "SI", "ES", "SE",
  // EEA (non-EU)
  "IS", "LI", "NO",
  // United Kingdom
  "GB",
]);

// gtag is defined synchronously in the <head> bootstrap (see __root.tsx), so it
// exists before hydration. We reuse that same global rather than redefining it.
type Gtag = (...args: unknown[]) => void;
function getGtag(): Gtag | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { gtag?: Gtag };
  return typeof w.gtag === "function" ? w.gtag : null;
}

/** Read the persisted choice, or null if none / outdated / unreadable. */
export function readConsent(): ConsentChoice | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ConsentChoice;
    // Re-prompt if the policy changed since the choice was made.
    if (parsed.version !== CONSENT_POLICY_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Persist the choice (our consent record) and return it. */
export function writeConsent(analytics: boolean): ConsentChoice {
  const choice: ConsentChoice = {
    analytics,
    ts: Date.now(),
    version: CONSENT_POLICY_VERSION,
  };
  try {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(choice));
    }
  } catch {
    // localStorage may be unavailable (private mode / blocked) — non-fatal.
  }
  return choice;
}

/** Tell Google tags the new analytics consent state (Consent Mode v2 update). */
export function updateGtagConsent(analytics: boolean): void {
  const gtag = getGtag();
  if (!gtag) return;
  gtag("consent", "update", {
    analytics_storage: analytics ? "granted" : "denied",
    // No ads product → ad_* signals stay denied at all times.
  });
}

let gaLoaded = false;
/** Inject gtag.js + configure GA4. Idempotent; only runs after consent. */
export function loadGa(): void {
  if (gaLoaded || typeof document === "undefined") return;
  const gtag = getGtag();
  if (!gtag) return;
  gaLoaded = true;

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(script);

  gtag("js", new Date());
  gtag("config", GA_MEASUREMENT_ID);
}

/** Grant analytics: flip the signal AND load GA. */
export function grantAnalytics(): void {
  updateGtagConsent(true);
  loadGa();
}

/** Deny analytics: flip the signal. If GA already loaded, it stops using cookies. */
export function denyAnalytics(): void {
  updateGtagConsent(false);
}

/**
 * Detect a browser-level opt-out (Global Privacy Control / Do Not Track).
 * When present we treat it as an explicit "reject" and skip the banner — this
 * honours the promise in our Cookie Policy (section 5).
 */
export function hasOptOutSignal(): boolean {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as unknown as {
    globalPrivacyControl?: boolean;
    doNotTrack?: string;
  };
  const win = window as unknown as { doNotTrack?: string };
  return (
    nav.globalPrivacyControl === true ||
    nav.doNotTrack === "1" ||
    win.doNotTrack === "1"
  );
}

/** Dispatch the "open cookie settings" event (used by the footer link). */
export function openCookieSettings(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(OPEN_COOKIE_SETTINGS_EVENT));
}
