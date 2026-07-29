import { createFileRoute } from "@tanstack/react-router";
import { InfiniteGridBackdrop } from "@/components/ui/the-infinite-grid";
import { HeroV3 } from "@/components/landing/hero-v3";
import { LandingNav } from "@/components/landing/landing-nav";
import { Coverage } from "@/components/landing/coverage";
import { Workflow } from "@/components/landing/workflow";
import { Features } from "@/components/landing/features";
import { ExposureCalculator } from "@/components/landing/exposure-calculator";
import { FinalCTA } from "@/components/landing/final-cta";
import { Footer } from "@/components/landing/footer";

// The public marketing landing page is served at the site root (hakkiu.com),
// not /landing. The old /landing URL still works — see src/routes/landing.tsx,
// which permanently redirects here (preserving ?book=demo|sales deep links).
export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      // Keyword-first <title>: matches how B2B buyers search ("trademark
      // monitoring software" / "brand protection software") rather than the
      // brand tagline, which no one searches for.
      { title: "HAKKIU — Trademark Monitoring & Brand Protection Software" },
      {
        name: "description",
        content:
          "HAKKIU monitors marketplaces and the open web 24/7, detects infringements with AI, and automates takedowns — built for brand owners and law firms.",
      },
      { property: "og:title", content: "HAKKIU — Trademark Monitoring & Brand Protection Software" },
      { name: "twitter:title", content: "HAKKIU — Trademark Monitoring & Brand Protection Software" },
      {
        property: "og:description",
        content:
          "AI-powered trademark monitoring, evidence capture, and one-click takedowns across Amazon, Shopify, and the web.",
      },
      // Structured data — SoftwareApplication. Rendered into <head> by the
      // router's built-in script:ld+json handler. No `offers`/price: HAKKIU
      // pricing is contact-only (book-a-demo pivot), so advertising a price
      // would risk Google's rich-result misrepresentation policy.
      {
        "script:ld+json": {
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          "@id": "https://hakkiu.com/#software",
          name: "HAKKIU",
          url: "https://hakkiu.com",
          applicationCategory: "BusinessApplication",
          applicationSubCategory: "Brand Protection Software",
          operatingSystem: "Web",
          description:
            "Autonomous brand protection: detect counterfeit listings, preserve court-ready evidence, and automate takedowns across marketplaces, social channels, and domains — from one workspace.",
          provider: { "@id": "https://hakkiu.com/#organization" },
          featureList: [
            "24/7 AI monitoring across 12+ marketplaces, social platforms and domains",
            "AI visual & text infringement detection with 0–100% threat scoring",
            "Forensic, court-ready evidence dossiers (screenshots, HTML, WHOIS, SHA-256 timestamps)",
            "Automated DMCA and trademark takedown workflows",
            "Audit log, resolution tracking and authorized-seller whitelisting",
          ],
        },
      },
    ],
    links: [{ rel: "canonical", href: "https://hakkiu.com/" }],
  }),
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="relative isolate min-h-screen bg-background text-foreground antialiased selection:bg-foreground selection:text-background">
      {/* One continuous animated grid + colour wash behind the ENTIRE page.
          Pinned to the viewport so it stays put while sections scroll over it;
          sections are transparent (see .technical-paper) so it reads as one field. */}
      <InfiniteGridBackdrop fixed />

      <div className="relative z-10">
        {/* TOP NAV */}
        <LandingNav />

        {/* 01 · HERO */}
        <HeroV3 />

      {/* 02 · MULTI-CHANNEL COVERAGE (dark) */}
      <Coverage />

      {/* 03 · HOW IT WORKS */}
      <Workflow />

      {/* 04 · PLATFORM ARCHITECTURE */}
      <Features />

      {/* 05 · BRAND EXPOSURE CALCULATOR */}
      <ExposureCalculator />

      {/* 06 · FINAL CTA (dark) */}
      <FinalCTA />

        {/* 08 · FOOTER */}
        <Footer />
      </div>
    </div>
  );
}
