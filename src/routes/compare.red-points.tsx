import { createFileRoute } from "@tanstack/react-router";
import { ComparePage, type ComparePageData } from "@/components/landing/compare-page";
import { COMPANY } from "@/lib/company";

const PATH = "/compare/red-points";
const TITLE = "Red Points Alternative — HAKKIU vs Red Points Compared";
const DESCRIPTION =
  "HAKKIU vs Red Points — an honest, EU-based comparison of AI brand protection: detection, legal-review evidence and takedowns, with no per-takedown fee.";

export const Route = createFileRoute("/compare/red-points")({
  head: () => ({
    meta: [
      { title: `${TITLE} | ${COMPANY.brand}` },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESCRIPTION },
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
          datePublished: "2026-07-29",
          dateModified: "2026-07-29",
          author: { "@id": `${COMPANY.baseUrl}/#organization` },
        },
      },
      {
        "script:ld+json": {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: `${COMPANY.baseUrl}/` },
            { "@type": "ListItem", position: 2, name: "HAKKIU vs Red Points", item: `${COMPANY.baseUrl}${PATH}` },
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
  competitor: "Red Points",
  subhead:
    "Red Points is a strong, established marketplace-enforcement platform. HAKKIU is an EU-based, AI-native option that captures legal-review-ready evidence — and, like Red Points, never charges per takedown.",
  fairAssessment:
    "Red Points is one of the most established names in marketplace counterfeit enforcement. Founded in 2014, it publicly reports 1,300+ brands protected across 5,000+ marketplaces, pairs its AI with a managed IP-Ops service, and states flat-fee pricing with unlimited detections and takedowns. If you are a large brand that needs very high-volume enforcement across global marketplaces with a managed team behind it, Red Points is a proven choice. HAKKIU is a leaner, EU-based alternative for teams that want an AI-native platform with transparent, legal-review-ready evidence.",
  rows: [
    { feature: "Headquarters", hakkiu: "EU — Kaunas, Lithuania", competitor: "US, Spain, China" },
    {
      feature: "Detection approach",
      hakkiu: "Tiered AI pipeline + human review",
      competitor: "AI + managed IP-Ops service",
    },
    {
      feature: "Channels monitored",
      hakkiu: "Marketplaces, social, app stores, domains, open web",
      competitor: "Marketplaces, websites, ads, social, domains",
    },
    {
      feature: "Evidence format for legal review",
      hakkiu: "Screenshots, WHOIS, SHA-256 hash + UTC timestamp",
      competitor: "Not published",
    },
    { feature: "Per-takedown fees", hakkiu: "None", competitor: "None (flat-fee)" },
    { feature: "Pricing", hakkiu: "On request", competitor: "On request" },
    { feature: "Public scale", hakkiu: "Early-stage", competitor: "1,300+ brands · 5,000+ marketplaces" },
  ],
  reasons: [
    {
      title: "EU-based and GDPR-native",
      body: "HAKKIU is headquartered in Kaunas, Lithuania, with core infrastructure hosted in the EEA and personal data processed under the GDPR — the standard European brand and legal teams expect.",
    },
    {
      title: "Evidence built for legal review",
      body: "Every detection captures high-resolution screenshots, WHOIS records and a SHA-256 hash with a UTC timestamp, packaged so it stands up when a case goes to a marketplace portal or a lawyer.",
    },
    {
      title: "AI with a human in the loop",
      body: "A tiered pipeline — keyword and typosquat checks, perceptual image hashing, then vision-language adjudication — scores every match by risk, and a person reviews consequential decisions before any notice is sent.",
    },
  ],
  extraNote: "Red Points publicly states flat-fee pricing with unlimited detections and takedowns.",
};
