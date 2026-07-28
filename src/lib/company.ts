// Single source of truth for company / legal details used across the public
// legal & company pages (Privacy, Terms, Imprint, DPA, etc.) and the footer.
//
// Company registration details (legal entity name, registration code, address,
// VAT) are not finalized yet, so they are left blank below and the pages omit
// them gracefully (the Imprint shows a "to be published" note). Fill them in
// HERE when available and every page updates automatically.
//
// These pages are templates, not legal advice — have them reviewed by qualified
// (Lithuanian/EU data-protection) counsel before publishing as binding.

export const COMPANY = {
  // Public brand name (safe to show everywhere).
  brand: "HAKKIU",
  tagline: "Automated Brand Enforcement",

  // Registered legal identity — TO BE ADDED once finalized. Leave blank for now.
  legalName: "HAKKIU",
  legalForm: "",
  registrationCode: "",
  registrationRegister: "",
  vatNumber: "",
  address: {
    line1: "",
    city: "",
    postalCode: "",
    country: "",
  },

  // Contact. Role-based aliases (set these up as forwards to your main inbox).
  email: {
    general: "info@hakkiu.com",
    privacy: "privacy@hakkiu.com", // data-protection / DPO contact
    legal: "legal@hakkiu.com",
    security: "security@hakkiu.com", // responsible disclosure
    support: "support@hakkiu.com",
  },
  phone: "",

  // Web.
  domain: "hakkiu.com",
  baseUrl: "https://hakkiu.com",
  linkedin: "https://www.linkedin.com/company/hakkiu/",

  // Governing law / jurisdiction for the Terms & DPA. Confirm on incorporation.
  governingLaw: "the Republic of Lithuania",
  jurisdiction: "the competent courts of the Republic of Lithuania",

  // Supervisory authority (data protection).
  supervisoryAuthority: {
    name: "State Data Protection Inspectorate (Valstybinė duomenų apsaugos inspekcija, VDAI)",
    country: "Lithuania",
    url: "https://vdai.lrv.lt/",
  },

  // Effective / last-updated date shown on every policy. Bump when you revise.
  effectiveDate: "28 July 2026",
} as const;

// Copyright line helper (year is computed at render time).
export function copyrightLine(): string {
  return `© ${new Date().getFullYear()} ${COMPANY.brand}`;
}
