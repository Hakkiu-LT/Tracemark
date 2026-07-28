import { createFileRoute } from "@tanstack/react-router";
import { HeroV3 } from "@/components/landing/hero-v3";
import { LandingNav } from "@/components/landing/landing-nav";
import { ProductProof } from "@/components/landing/product-proof";
import { Coverage } from "@/components/landing/coverage";
import { Workflow } from "@/components/landing/workflow";
import { Features } from "@/components/landing/features";
import { ExposureCalculator } from "@/components/landing/exposure-calculator";
import { FinalCTA } from "@/components/landing/final-cta";
import { Footer } from "@/components/landing/footer";

export const Route = createFileRoute("/landing")({
  head: () => ({
    meta: [
      { title: "HAKKIU — Protect your brand at internet speed" },
      {
        name: "description",
        content:
          "HAKKIU monitors marketplaces and the open web 24/7, detects infringements with AI, and automates takedowns — built for brand owners and law firms.",
      },
      { property: "og:title", content: "HAKKIU — Protect your brand at internet speed" },
      {
        property: "og:description",
        content:
          "AI-powered trademark monitoring, evidence capture, and one-click takedowns across Amazon, Shopify, and the web.",
      },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground antialiased selection:bg-foreground selection:text-background">
      {/* TOP NAV */}
      <LandingNav />

      {/* 01 · HERO */}
      <HeroV3 />

      {/* 02 · PRODUCT PROOF — detection → takedown */}
      <ProductProof />

      {/* 03 · MULTI-CHANNEL COVERAGE (dark) */}
      <Coverage />

      {/* 04 · HOW IT WORKS */}
      <Workflow />

      {/* 05 · PLATFORM ARCHITECTURE */}
      <Features />

      {/* 06 · BRAND EXPOSURE CALCULATOR */}
      <ExposureCalculator />

      {/* 07 · FINAL CTA (dark) */}
      <FinalCTA />

      {/* 08 · FOOTER */}
      <Footer />
    </div>
  );
}
