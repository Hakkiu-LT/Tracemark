import { createFileRoute } from "@tanstack/react-router";
import { ComparePage, type ComparePageData } from "@/components/landing/compare-page";
import { COMPANY } from "@/lib/company";

const PATH = "/compare/brandshield";
const TITLE = "BrandShield Alternative — HAKKIU vs BrandShield Compared";
const DESCRIPTION =
  "HAKKIU vs BrandShield: an honest comparison. BrandShield covers broad digital risk and phishing; HAKKIU is a focused, EU-based trademark and counterfeit enforcement platform. Book a demo.";

export const Route = createFileRoute("/compare/brandshield")({
  head: () => ({
    meta: [
      { title: `${TITLE} | ${COMPANY.brand}` },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      {
        "script:ld+json": {
          "@context": "https://schema.org",
          "@type": "WebPage",
          "@id": `${COMPANY.baseUrl}${PATH}#webpage`,
          url: `${COMPANY.baseUrl}${PATH}`,
          name: TITLE,
          description: DESCRIPTION,
          isPartOf: { "@id": `${COMPANY.baseUrl}/#website` },
          about: { "@id": `${COMPANY.baseUrl}/#organization` },
        },
      },
      {
        "script:ld+json": {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: `${COMPANY.baseUrl}/` },
            { "@type": "ListItem", position: 2, name: "Compare", item: `${COMPANY.baseUrl}/compare/brandshield` },
            { "@type": "ListItem", position: 3, name: "HAKKIU vs BrandShield", item: `${COMPANY.baseUrl}${PATH}` },
          ],
        },
      },
      { property: "og:url", content: `${COMPANY.baseUrl}${PATH}` },
    ],
    links: [{ rel: "canonical", href: `${COMPANY.baseUrl}${PATH}` }],
  }),
  component: () => <ComparePage data={DATA} />,
});

const DATA: ComparePageData = {
  competitor: "BrandShield",
  subhead:
    "BrandShield is a broad digital-risk platform spanning phishing and executive impersonation. HAKKIU is focused on trademark and counterfeit enforcement, with EU data residency and legal-review-ready evidence.",
  fairAssessment:
    "BrandShield, founded in 2013 and listed on the London Stock Exchange, is a broad digital-risk platform. Alongside brand protection it covers phishing sites, executive impersonation and dark-web monitoring, and publicly reports 100M+ verified takedowns a year with a 24/7 security operations centre. If your priority is enterprise-wide digital risk across security and brand together, BrandShield is built for that breadth. HAKKIU takes a narrower, focused approach — trademark abuse, marketplace counterfeits and lookalike domains — for teams that want depth in brand protection without paying for a full digital-risk suite.",
  rows: [
    { feature: "Headquarters", hakkiu: "EU — Kaunas, Lithuania", competitor: "Israel" },
    {
      feature: "Primary focus",
      hakkiu: "Trademark & counterfeit enforcement",
      competitor: "Broad digital risk (phishing, impersonation)",
    },
    { feature: "Phishing & executive-impersonation protection", hakkiu: false, competitor: true },
    { feature: "Marketplace counterfeit detection", hakkiu: true, competitor: true },
    {
      feature: "Evidence format for legal review",
      hakkiu: "Screenshots, WHOIS, SHA-256 hash + UTC timestamp",
      competitor: "Not published",
    },
    { feature: "Pricing", hakkiu: "On request", competitor: "On request" },
    { feature: "Public scale", hakkiu: "Early-stage", competitor: "100M+ takedowns / year" },
  ],
  reasons: [
    {
      title: "Focused, not broad",
      body: "HAKKIU concentrates on trademark abuse, marketplace counterfeits and lookalike domains — the core of brand protection — rather than spreading across a full digital-risk suite you may not need.",
    },
    {
      title: "EU data residency",
      body: "Headquartered in Kaunas, Lithuania, with EEA-hosted infrastructure and GDPR-aligned processing — the jurisdiction and data-residency posture European buyers expect.",
    },
    {
      title: "Evidence built for legal review",
      body: "Screenshots, WHOIS records and a SHA-256 hash with a UTC timestamp are captured on every detection, packaged so each case holds up with a marketplace or a lawyer.",
    },
  ],
  extraNote: "BrandShield Systems Plc is listed on the London Stock Exchange.",
};
