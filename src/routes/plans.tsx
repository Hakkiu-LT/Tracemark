import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { LandingNav } from "@/components/landing/landing-nav";
import { Pricing } from "@/components/landing/pricing";

export const Route = createFileRoute("/plans")({
  head: () => ({ meta: [{ title: "Plans & Pricing – Tracemark" }] }),
  component: PlansPage,
});

function PlansPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between">
      <div>
        {/* TOP NAV — transparent over the hero, gains a background on scroll */}
        <LandingNav />

        {/* PRICING SECTION */}
        <div className="relative bg-background pt-16">
          <div className="dot-bg-band pointer-events-none absolute inset-0" aria-hidden="true" />
          <div className="relative">
            <Pricing />
          </div>
        </div>
      </div>

      <footer className="border-t border-border bg-background">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-8 text-sm text-muted-foreground md:flex-row">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[oklch(0.58_0.18_255)]" />
            <span className="font-semibold text-foreground">Tracemark</span>
            <span>· Brand protection, automated.</span>
            <span>· Made with AI.</span>
          </div>
          <div>© {new Date().getFullYear()} Tracemark. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
}
