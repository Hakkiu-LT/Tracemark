import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { HeroV3 } from "@/components/landing/hero-v3";
import { LandingNav } from "@/components/landing/landing-nav";
import { Workflow } from "@/components/landing/workflow";
import { Coverage } from "@/components/landing/coverage";
import { Features } from "@/components/landing/features";
import { ExposureCalculator } from "@/components/landing/exposure-calculator";
import { Button } from "@/components/ui/button";
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

      {/* BOOK A DEMO CTA */}
      <div className="border-t border-border/60 bg-muted/20 py-24 text-center">
        <div className="mx-auto max-w-4xl px-6 flex flex-col items-center">
          <p className="font-mono text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            READY TO DEPLOY BRAND DEFENSE?
          </p>
          <h3 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            Built for brand teams and IP professionals.
          </h3>
          <p className="mt-4 max-w-xl text-base text-muted-foreground">
            See HAKKIU in action. Book a demo and our team will tailor brand protection to your
            monitoring needs.
          </p>
          <Button
            asChild
            size="lg"
            className="mt-8 h-12 gap-2 rounded-lg bg-foreground px-8 text-sm font-semibold text-background shadow-md hover:bg-foreground/90 transition-all cursor-pointer"
          >
            <Link to="/request-demo">
              Book a demo
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      {/* FOOTER */}
      <Footer />
    </div>
  );
}
