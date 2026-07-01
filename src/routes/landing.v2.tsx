import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { HeroV2 } from "@/components/landing/hero-v2";
import { LandingNav } from "@/components/landing/landing-nav";
import { Workflow } from "@/components/landing/workflow";
import { Coverage } from "@/components/landing/coverage";
import { Features } from "@/components/landing/features";
import { Pricing } from "@/components/landing/pricing";
import { CTA } from "@/components/landing/cta";

export const Route = createFileRoute("/landing/v2")({
  head: () => ({
    meta: [
      { title: "Tracemark — Protect your brand at internet speed" },
      {
        name: "description",
        content:
          "Tracemark monitors marketplaces and the open web 24/7, detects infringements with AI, and automates takedowns — built for brand owners and law firms.",
      },
      { property: "og:title", content: "Tracemark — Protect your brand at internet speed" },
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
    <>
      {/* TOP NAV — transparent over the hero, gains a background on scroll */}
      <LandingNav />

      {/* HERO */}
      <HeroV2 />

      {/* COVERAGE */}
      <Coverage />

      {/* HOW IT WORKS → FEATURES → PRICING share one continuous static dotted
          field. The band sits behind the (now transparent) sections so the dot
          grid runs unbroken from "From detection to takedown" down through the
          pricing plans. */}
      <div className="relative bg-background">
        <div className="dot-bg-band pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="relative">
          {/* HOW IT WORKS */}
          <Workflow />

          {/* FEATURES */}
          <Features />

          {/* USE CASES & PRICING */}
          <Pricing />
        </div>
      </div>

      {/* CLOSING CTA */}
      <CTA />

      <footer className="border-t border-border bg-background">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-8 text-sm text-muted-foreground md:flex-row">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[oklch(0.58_0.18_255)]" />
            <span className="font-semibold text-foreground">Tracemark</span>
            <span>· Brand protection, automated.</span>
          </div>
          <div>© {new Date().getFullYear()} Tracemark. All rights reserved.</div>
        </div>
      </footer>
    </>
  );
}
