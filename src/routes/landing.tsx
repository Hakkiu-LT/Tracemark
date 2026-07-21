import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { HakkiuLogo } from "@/components/hakkiu-logo";
import { HeroV3 } from "@/components/landing/hero-v3";
import { LandingNav } from "@/components/landing/landing-nav";
import { Workflow } from "@/components/landing/workflow";
import { Coverage } from "@/components/landing/coverage";
import { Features } from "@/components/landing/features";
import { ExposureCalculator } from "@/components/landing/exposure-calculator";
import { Button } from "@/components/ui/button";

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
    <>
      {/* TOP NAV — transparent over the hero, gains a background on scroll */}
      <LandingNav />

      {/* HERO */}
      <HeroV3 />

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

          {/* BRAND EXPOSURE CALCULATOR */}
          <ExposureCalculator />

          {/* COMPARE PLANS AND PRICING CTA */}
          <div className="mx-auto max-w-[80rem] px-6 pb-20 pt-10 md:px-10 lg:px-12 flex flex-col items-center justify-center text-center">
            <h3 className="font-display text-2xl font-bold tracking-tight mb-4">
              Plans built for brand teams and IP professionals
            </h3>
            <p className="mx-auto max-w-2xl text-base leading-relaxed text-muted-foreground mb-6">
              Choose the plan that fits your team and enforcement needs.
            </p>
            <Button asChild size="lg" className="h-12 gap-2 rounded-xl bg-[oklch(0.55_0.19_262)] px-8 text-base shadow-lg shadow-[oklch(0.55_0.19_262/0.28)] hover:bg-[oklch(0.5_0.19_262)] cursor-pointer">
              <Link to="/plans">
                Compare plans and pricing
                <ArrowRight className="h-4.5 w-4.5" />
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <footer className="border-t border-border bg-background">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-8 text-sm text-muted-foreground md:flex-row">
          <div className="flex items-center gap-2">
            <HakkiuLogo className="h-6 text-foreground" />
            <span>· Brand protection, automated.</span>
            <span>· Made with AI.</span>
          </div>
          <div>© {new Date().getFullYear()} HAKKIU. All rights reserved.</div>
        </div>
      </footer>
    </>
  );
}
