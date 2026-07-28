// Server function that decides whether the current visitor legally needs a
// cookie-consent banner, based on their country.
//
// Runs ONLY on the server (Cloudflare Worker). Cloudflare adds the visitor's
// two-letter country to the `CF-IPCountry` request header, which we read via
// TanStack Start's request helpers. The client calls this once, on first visit
// (returning visitors are decided from localStorage, no server round-trip).

import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { CONSENT_REQUIRED_COUNTRIES } from "./consent";

export const getConsentRequired = createServerFn({ method: "GET" }).handler(() => {
  const country = (getRequestHeader("cf-ipcountry") ?? "").toUpperCase();

  // Unknown ("XX"), Tor ("T1"), or missing → assume consent is required (safe
  // default: never fire analytics for someone we can't place).
  if (!country || country === "XX" || country === "T1") {
    return { consentRequired: true, country };
  }

  return {
    consentRequired: CONSENT_REQUIRED_COUNTRIES.has(country),
    country,
  };
});
