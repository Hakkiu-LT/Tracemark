import { createFileRoute } from "@tanstack/react-router";
import { ComparePage, type ComparePageData, type CompareFaq } from "@/components/landing/compare-page";
import { COMPANY } from "@/lib/company";

const PATH = "/compare/red-points";
const TITLE = "Red Points Alternative — HAKKIU vs Red Points Compared";
const DESCRIPTION =
  "HAKKIU vs Red Points — an honest, EU-based comparison of AI brand protection: detection, legal-review evidence and takedowns, with no per-takedown fee.";

const FAQS: CompareFaq[] = [
  {
    q: "Is HAKKIU a like-for-like replacement for Red Points?",
    a: "For the core job — finding counterfeit listings on marketplaces, capturing the evidence and getting them taken down — the loop is the same on both. Where Red Points is genuinely ahead is scale and its managed IP-Ops team: if you want people running enforcement for you across thousands of marketplaces, that is what they are built for. HAKKIU is the fit when you would rather run it yourself on an EU-based platform and keep the evidence trail in your own hands.",
  },
  {
    q: "Does HAKKIU charge per takedown?",
    a: "No. You are never billed per detection or per takedown, so a bad month with a spike in infringements does not turn into a bigger invoice. To be fair, this is not a HAKKIU-only thing — Red Points markets flat-fee pricing with unlimited takedowns too. Ask any other vendor the same question, because some of them still meter it.",
  },
  {
    q: "We sell mostly into Europe — does the EU base actually matter?",
    a: "It can. HAKKIU is headquartered in Kaunas, Lithuania, runs its core infrastructure inside the EEA and processes personal data under the GDPR. If your legal team cares where evidence and account data physically sit — and a lot of European buyers do — that is one fewer thing to negotiate in a data-processing review.",
  },
  {
    q: "You are new. Why trust you over a company protecting 1,300+ brands?",
    a: "Honestly, you should not just take our word for it — Red Points has a track record we do not yet. What we would ask is that you judge us on a demo against your own brand: point us at your marks and authorized sellers and see what we surface, and look closely at how each detection is captured (screenshots, WHOIS, a SHA-256 hash and a UTC timestamp). Being early also means you talk to the people who built the product, not a queue.",
  },
];

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
      {
        "script:ld+json": {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          "@id": `${COMPANY.baseUrl}${PATH}#faq`,
          mainEntity: FAQS.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
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
    {
      feature: "Detection approach",
      hakkiu: "Tiered AI pipeline + human review",
      competitor: "AI + managed IP-Ops service",
    },
    {
      feature: "Evidence format for legal review",
      hakkiu: "Screenshots, WHOIS, SHA-256 hash + UTC timestamp",
      competitor: "Not published",
    },
    {
      feature: "Channels monitored",
      hakkiu: "Marketplaces, social, app stores, domains, open web",
      competitor: "Marketplaces, websites, ads, social, domains",
    },
    { feature: "Per-takedown fees", hakkiu: "None", competitor: "None (flat-fee)" },
    { feature: "Pricing", hakkiu: "On request", competitor: "On request" },
    { feature: "Headquarters", hakkiu: "EU — Kaunas, Lithuania", competitor: "US, Spain, China" },
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
  verdict: {
    competitorFit:
      "you are a large brand pushing high volumes across thousands of marketplaces and you want a managed team doing the enforcement work for you. Red Points has been doing exactly that since 2014, and the scale shows.",
    hakkiuFit:
      "you would rather run enforcement on an EU-based platform, see precisely how each detection was captured, and reach the people who built the tool. We are smaller — and for a lot of teams that directness is the whole point.",
  },
  faqs: FAQS,
  extraNote: "Red Points publicly states flat-fee pricing with unlimited detections and takedowns.",
};
