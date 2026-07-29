import { createFileRoute } from "@tanstack/react-router";
import { ComparePage, type ComparePageData, type CompareFaq } from "@/components/landing/compare-page";
import { COMPANY } from "@/lib/company";

const PATH = "/compare/brandshield";
const TITLE = "BrandShield Alternative — HAKKIU vs BrandShield Compared";
const DESCRIPTION =
  "HAKKIU vs BrandShield — an honest comparison: BrandShield covers broad digital risk; HAKKIU is a focused, EU-based trademark enforcement platform.";

const FAQS: CompareFaq[] = [
  {
    q: "What is the real difference between HAKKIU and BrandShield?",
    a: "Scope. BrandShield is a broad digital-risk suite — brand protection sits next to phishing takedowns, fake-executive accounts and dark-web monitoring, with a 24/7 security operations centre behind it. HAKKIU deliberately stays narrower: counterfeits, marketplace abuse and lookalike domains, done in depth. If your problem is wider than fakes and grey-market sellers, that breadth is exactly what you are paying BrandShield for.",
  },
  {
    q: "We also get hit by phishing and fake executive accounts. Can HAKKIU handle that?",
    a: "No, and we would rather say so plainly than sell you something that does not fit. Phishing sites and executive impersonation are squarely BrandShield's territory, and we mark that honestly in the table above. HAKKIU stays in the trademark and counterfeit lane on purpose. If impersonation is a live problem for you today, do not buy us to solve it.",
  },
  {
    q: "Does staying focused actually help us, or is it just a smaller product?",
    a: "It helps in two concrete ways. You are not paying for a full digital-risk platform to solve a counterfeit problem, and the whole tool is built around one loop — detect a fake, capture evidence, get it removed — rather than spreading across a dozen risk categories. You also get EU data residency and evidence formatted for legal review, which is what most brand and IP teams we talk to actually need first.",
  },
  {
    q: "BrandShield is listed on the LSE and reports 100M+ takedowns a year. Why look at a startup?",
    a: "Fair question, and we are not going to pretend to their track record. What we would ask is that you run a demo against your own brand and look hard at how each detection is captured — screenshots, WHOIS, a SHA-256 hash and a UTC timestamp — because that is what you will hand to a marketplace or a lawyer. Being early also means the people who built the product are the ones you talk to.",
  },
];

export const Route = createFileRoute("/compare/brandshield")({
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
            { "@type": "ListItem", position: 2, name: "HAKKIU vs BrandShield", item: `${COMPANY.baseUrl}${PATH}` },
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
  competitor: "BrandShield",
  subhead:
    "BrandShield is a broad digital-risk platform spanning phishing and executive impersonation. HAKKIU is focused on trademark and counterfeit enforcement, with EU data residency and legal-review-ready evidence.",
  fairAssessment:
    "BrandShield, founded in 2013 and listed on the London Stock Exchange, is a broad digital-risk platform. Alongside brand protection it covers phishing sites, executive impersonation and dark-web monitoring, and publicly reports 100M+ verified takedowns a year with a 24/7 security operations centre. If your priority is enterprise-wide digital risk across security and brand together, BrandShield is built for that breadth. HAKKIU takes a narrower, focused approach — trademark abuse, marketplace counterfeits and lookalike domains — for teams that want depth in brand protection without paying for a full digital-risk suite.",
  rows: [
    { feature: "Marketplace counterfeit detection", hakkiu: true, competitor: true },
    {
      feature: "Evidence format for legal review",
      hakkiu: "Screenshots, WHOIS, SHA-256 hash + UTC timestamp",
      competitor: "Not published",
    },
    {
      feature: "Primary focus",
      hakkiu: "Trademark & counterfeit enforcement",
      competitor: "Broad digital risk (phishing, impersonation)",
    },
    { feature: "Phishing & executive-impersonation protection", hakkiu: false, competitor: true },
    { feature: "Pricing", hakkiu: "On request", competitor: "On request" },
    { feature: "Headquarters", hakkiu: "EU — Kaunas, Lithuania", competitor: "Israel" },
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
  verdict: {
    competitorFit:
      "brand protection is one slice of a bigger security problem — phishing pages, fake executive accounts, dark-web leaks — and you want the lot under one roof with a 24/7 team watching it. That breadth is what BrandShield is for.",
    hakkiuFit:
      "your actual problem is counterfeits, grey-market sellers and lookalike domains, and you would rather not buy a whole digital-risk suite to deal with it. Focused and EU-based, with evidence you can hand straight to a lawyer.",
  },
  faqs: FAQS,
  extraNote: "BrandShield Systems Plc is listed on the London Stock Exchange.",
};
