import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, ArrowRight } from "lucide-react";
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
    <div className="min-h-screen bg-background text-foreground antialiased selection:bg-foreground selection:text-background">
      {/* TOP NAV */}
      <LandingNav />

      {/* HERO SECTION */}
      <HeroV3 />

      {/* MULTI-CHANNEL COVERAGE */}
      <Coverage />

      {/* HOW IT WORKS */}
      <Workflow />

      {/* PLATFORM FEATURES */}
      <Features />

      {/* BRAND EXPOSURE CALCULATOR */}
      <ExposureCalculator />

      {/* COMPARE PLANS AND PRICING CTA */}
      <div className="border-t border-border/60 bg-muted/20 py-24 text-center">
        <div className="mx-auto max-w-4xl px-6 flex flex-col items-center">
          <p className="font-mono text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            READY TO DEPLOY BRAND DEFENSE?
          </p>
          <h3 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            Plans built for brand teams and IP professionals.
          </h3>
          <p className="mt-4 max-w-xl text-base text-muted-foreground">
            Start protecting your brand today with flexible plans tailored to your monitoring volume.
          </p>
          <Button
            asChild
            size="lg"
            className="mt-8 h-12 gap-2 rounded-lg bg-foreground px-8 text-sm font-semibold text-background shadow-md hover:bg-foreground/90 transition-all cursor-pointer"
          >
            <Link to="/plans">
              Compare Plans & Pricing
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      {/* VERCEL STYLE FOOTER */}
      <footer className="border-t border-border/60 bg-background py-12">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 text-xs text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex h-5 w-5 items-center justify-center rounded bg-foreground text-background font-bold">
              <ShieldCheck className="h-3 w-3" />
            </div>
            <span className="font-semibold text-foreground">Tracemark</span>
            <span>· Automated Brand Enforcement</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 font-mono text-[11px]">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              All Systems Operational
            </span>
            <span>© {new Date().getFullYear()} Tracemark, Inc.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
