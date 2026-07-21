import { createFileRoute } from "@tanstack/react-router";
import { LandingNav } from "@/components/landing/landing-nav";
import { HakkiuLogo } from "@/components/hakkiu-logo";
import { Pricing } from "@/components/landing/pricing";

export const Route = createFileRoute("/plans")({
  head: () => ({ meta: [{ title: "Plans & Pricing – HAKKIU" }] }),
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
            <HakkiuLogo className="h-6 text-foreground" />
            <span>· Brand protection, automated.</span>
            <span>· Made with AI.</span>
          </div>
          <div>© {new Date().getFullYear()} HAKKIU. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
}
