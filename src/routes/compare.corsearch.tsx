import { createFileRoute } from "@tanstack/react-router";
import { ComparePage, type ComparePageData, type CompareFaq } from "@/components/landing/compare-page";
import { COMPANY } from "@/lib/company";

const PATH = "/compare/corsearch";
const TITLE = "Corsearch Alternative — HAKKIU vs Corsearch Compared";
const DESCRIPTION =
  "HAKKIU vs Corsearch — an honest comparison: Corsearch is a full-lifecycle enterprise IP suite; HAKKIU is a leaner, AI-native, EU-based option.";

const FAQS: CompareFaq[] = [
  {
    q: "HAKKIU vs Corsearch — who is each one really for?",
    a: "Corsearch is built for enterprise IP departments that need the whole lifecycle: trademark clearance and global watching across many jurisdictions, then brand protection and content enforcement, with analysts in the loop. HAKKIU is for growing brands and smaller IP teams that want fast online enforcement across marketplaces, domains and the open web, without an enterprise rollout. They sit at opposite ends of the same market.",
  },
  {
    q: "Does HAKKIU do trademark clearance and watching like Corsearch?",
    a: "No. HAKKIU is an online-enforcement platform — it finds and helps you remove counterfeits, unauthorized sellers and lookalike domains. Clearance searches and global trademark watching across 1,000+ databases are a different discipline, and it is one Corsearch has decades of legal-data heritage in. If clearance is what you need, that is genuinely their strength, not ours.",
  },
  {
    q: "We are a smaller IP team. Will HAKKIU fit without a big implementation?",
    a: "That is who it is designed for. Connect your marks and your authorized sellers, and monitoring starts across marketplaces, domains and the open web — no enterprise procurement cycle and no dedicated IP-operations administrator to keep it running. A person still reviews the consequential calls before any notice goes out, so you are not handing enforcement to a model unsupervised.",
  },
  {
    q: "Corsearch has roots to 1949 and protects 73+ Fortune 100 companies. Why a 2026 startup?",
    a: "Because the question is usually fit, not age. An enterprise suite built for Fortune-100 IP departments can be more than a growing brand needs — and priced accordingly. We are new, so judge us on a demo against your own marks and on how each detection is captured (screenshots, WHOIS, a SHA-256 hash and a UTC timestamp). You also get EU data residency and direct access to the team that built it.",
  },
];

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
  competitor: "Corsearch",
  subhead:
    "Corsearch is a full-lifecycle, enterprise IP suite with decades of trademark-data heritage. HAKKIU is a leaner, AI-native, EU-based option for growing brands and smaller IP teams.",
  fairAssessment:
    "If your IP department lives in clearance searches and multi-jurisdiction watching, Corsearch is in a class of its own. Its corporate roots trace to 1949, it runs the full lifecycle from clearance and watching through to brand protection and piracy enforcement, and it pairs AI detection with expert analysts. Publicly it reports protecting 73+ Fortune 100 companies across 1,000+ trademark databases. That is a different job from the one HAKKIU is built for: growing brands and smaller IP teams that want fast online enforcement without an enterprise implementation.",
  rows: [
    { feature: "Online marketplace & domain monitoring", hakkiu: true, competitor: true },
    {
      feature: "Detection approach",
      hakkiu: "Tiered AI pipeline + human review",
      competitor: "AI detection + expert analyst oversight",
    },
    {
      feature: "Best fit",
      hakkiu: "Growing brands & smaller IP teams",
      competitor: "Enterprise / Fortune-100 IP departments",
    },
    { feature: "Trademark clearance & legal-data heritage", hakkiu: false, competitor: true },
    { feature: "Pricing", hakkiu: "On request", competitor: "On request" },
    { feature: "Headquarters", hakkiu: "EU — Kaunas, Lithuania", competitor: "US & UK" },
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
  verdict: {
    competitorFit:
      "you are an enterprise IP department that needs the full lifecycle — clearance and global watching across many jurisdictions through to analyst-led investigations. Corsearch has been in trademark data since 1949, and that depth is hard to match.",
    hakkiuFit:
      "you are a growing brand or a smaller IP team that wants fast online enforcement across marketplaces, domains and the open web, without an enterprise implementation or someone whose whole job is running the tool.",
  },
  faqs: FAQS,
  extraNote: "Corsearch's corporate roots trace to 1949; it operates across the US and UK.",
};
