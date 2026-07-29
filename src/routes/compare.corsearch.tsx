import { createFileRoute } from "@tanstack/react-router";
import { ComparePage, type ComparePageData } from "@/components/landing/compare-page";
import { COMPANY } from "@/lib/company";

const PATH = "/compare/corsearch";
const TITLE = "Corsearch Alternative — HAKKIU vs Corsearch Compared";
const DESCRIPTION =
  "HAKKIU vs Corsearch — an honest comparison: Corsearch is a full-lifecycle enterprise IP suite; HAKKIU is a leaner, AI-native, EU-based option.";

export const Route = createFileRoute("/compare/corsearch")({
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
            { "@type": "ListItem", position: 2, name: "HAKKIU vs Corsearch", item: `${COMPANY.baseUrl}${PATH}` },
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
  competitor: "Corsearch",
  subhead:
    "Corsearch is a full-lifecycle, enterprise IP suite with decades of trademark-data heritage. HAKKIU is a leaner, AI-native, EU-based option for growing brands and smaller IP teams.",
  fairAssessment:
    "Corsearch is one of the deepest names in the trademark and brand-protection market, with corporate roots tracing to 1949. It offers the full lifecycle — trademark clearance and watching through to brand protection and content/piracy enforcement — combines AI detection with expert analyst oversight, and publicly reports protecting 73+ Fortune 100 companies across 1,000+ trademark databases. If you are a large enterprise IP department that needs clearance, global watching across many jurisdictions and analyst-led investigations, Corsearch's depth is hard to match. HAKKIU is built for the opposite end: growing brands and smaller IP teams that want fast, AI-native online enforcement without an enterprise implementation.",
  rows: [
    { feature: "Headquarters", hakkiu: "EU — Kaunas, Lithuania", competitor: "US & UK" },
    {
      feature: "Best fit",
      hakkiu: "Growing brands & smaller IP teams",
      competitor: "Enterprise / Fortune-100 IP departments",
    },
    { feature: "Trademark clearance & legal-data heritage", hakkiu: false, competitor: true },
    { feature: "Online marketplace & domain monitoring", hakkiu: true, competitor: true },
    {
      feature: "Detection approach",
      hakkiu: "Tiered AI pipeline + human review",
      competitor: "AI detection + expert analyst oversight",
    },
    { feature: "Pricing", hakkiu: "On request", competitor: "On request" },
    { feature: "Founded", hakkiu: "2026", competitor: "Roots to 1949" },
  ],
  reasons: [
    {
      title: "Built for growing brands",
      body: "HAKKIU is designed for brands and smaller IP teams — not only Fortune-100 IP departments — so you get online enforcement without an enterprise procurement cycle or a dedicated IP-operations administrator.",
    },
    {
      title: "AI-native and fast to start",
      body: "A tiered AI pipeline with human review handles detection out of the box: connect your marks and authorized sellers, and monitoring begins across marketplaces, domains and the open web.",
    },
    {
      title: "EU data residency + legal-review evidence",
      body: "Headquartered in Kaunas, Lithuania, with EEA hosting and GDPR-aligned processing, and every detection captured as screenshots, WHOIS and a SHA-256 hash with a UTC timestamp for legal review.",
    },
  ],
  extraNote: "Corsearch's corporate roots trace to 1949; it operates across the US and UK.",
};
