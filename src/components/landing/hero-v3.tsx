import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BlueprintOverlay } from "./blueprint";
import { ProductWindow } from "./product-window";
import { Reveal } from "./reveal";
import { useLeadModals } from "./lead-modals";

const TRUST = ["No setup fee", "Instant domain & marketplace scan", "Court-ready evidence"];

export function HeroV3() {
  const { openDemo, openSales } = useLeadModals();

  return (
    <section
      id="top"
      className="technical-paper relative flex flex-col items-center border-b border-border/60 pt-28 pb-16 md:pt-36 md:pb-24"
    >
      <BlueprintOverlay variant="hero" />

      <div className="relative mx-auto flex w-full max-w-5xl flex-col items-center px-6 text-center">
        <Reveal
          as="p"
          className="font-mono text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground"
        >
          Autonomous brand protection
        </Reveal>

        <Reveal
          as="h1"
          delay={70}
          className="mt-6 max-w-4xl font-display text-4xl font-extrabold leading-[1.04] tracking-tight text-foreground sm:text-6xl md:text-7xl"
        >
          Protect your brand
          <br className="hidden sm:inline" /> at internet speed.
        </Reveal>

        <Reveal
          as="p"
          delay={140}
          className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg"
        >
          Detect counterfeit listings, preserve court-ready evidence, and launch takedowns across
          every marketplace, social channel, and domain — from one workspace.
        </Reveal>

        <Reveal delay={200} className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Button
            size="lg"
            onClick={openDemo}
            className="flex h-12 items-center gap-2 rounded-lg bg-foreground px-7 text-sm font-semibold text-background shadow-md transition-all hover:bg-foreground/90 hover:shadow-lg"
          >
            Book a demo
            <ArrowRight className="h-4 w-4" />
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={openSales}
            className="h-12 rounded-lg border-border bg-card px-7 text-sm font-semibold text-foreground transition-all hover:border-foreground/40 hover:bg-muted"
          >
            Talk to sales
          </Button>
        </Reveal>

        <Reveal
          delay={260}
          className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground"
        >
          {TRUST.map((t) => (
            <span key={t} className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" style={{ color: "var(--mint, #18c889)" }} />
              {t}
            </span>
          ))}
        </Reveal>
      </div>

      {/* Product window lifts in — the hero's anchor visual. */}
      <Reveal
        delay={320}
        y={24}
        threshold={0.05}
        className="relative z-10 mt-14 w-full max-w-5xl px-6"
      >
        <ProductWindow scan />
      </Reveal>
    </section>
  );
}
