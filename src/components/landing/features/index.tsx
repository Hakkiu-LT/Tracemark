import {
  Activity,
  Sparkles,
  FileCheck,
  Send,
  ArrowRight,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { BlueprintOverlay } from "../blueprint";
import { Reveal, useInView } from "../reveal";
import { useLeadModals } from "../lead-modals";
import { cn } from "@/lib/utils";

type Module = {
  icon: LucideIcon;
  title: string;
  body: string;
  /** Grid placement on the desktop quadrant layout. */
  corner: "tl" | "tr" | "bl" | "br";
};

const MODULES: Module[] = [
  {
    icon: Activity,
    title: "24/7 multi-channel surveillance",
    body: "Automated crawlers scan 12+ marketplaces, social platforms, app stores, and domain registries around the clock.",
    corner: "tl",
  },
  {
    icon: Sparkles,
    title: "AI visual & text matcher",
    body: "Vision and language models compare listings against your registry to catch modified logos and typo-squats.",
    corner: "tr",
  },
  {
    icon: FileCheck,
    title: "Forensic evidence dossiers",
    body: "Screenshots, page HTML, WHOIS records, and cryptographic timestamps — archived court-ready, automatically.",
    corner: "bl",
  },
  {
    icon: Send,
    title: "1-click marketplace enforcement",
    body: "Direct dispatch to Amazon Brand Registry, Shopify, Google DMCA, and registrar notice portals.",
    corner: "br",
  },
];

// Connector endpoints in the SVG's stretched coordinate space (preserveAspect
// none), pointing from the central engine out to each quadrant module. Because
// the viewBox stretches to the container, these always aim at the right card.
const LINES: Record<Module["corner"], string> = {
  tl: "M500 300 C 340 260, 240 200, 150 150",
  tr: "M500 300 C 660 260, 760 200, 850 150",
  bl: "M500 300 C 340 340, 240 400, 150 450",
  br: "M500 300 C 660 340, 760 400, 850 450",
};

function ModuleCard({ m, delay }: { m: Module; delay: number }) {
  const Icon = m.icon;
  return (
    <Reveal
      delay={delay}
      className="relative rounded-2xl border border-border/80 bg-card p-6 shadow-sm transition-all hover:-translate-y-1 hover:border-foreground/30 hover:shadow-md"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-muted/40 text-foreground">
        <Icon className="h-5 w-5" strokeWidth={2} />
      </div>
      <h3 className="mt-4 font-display text-base font-bold tracking-tight text-foreground">
        {m.title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{m.body}</p>
    </Reveal>
  );
}

function pick(corner: Module["corner"]) {
  return MODULES.find((m) => m.corner === corner)!;
}

export function Features() {
  const { openDemo } = useLeadModals();
  const { ref, inView } = useInView<HTMLDivElement>(0.25);

  return (
    <section
      id="features"
      className="technical-paper relative scroll-mt-16 border-b border-border/60 py-20 md:py-24"
    >
      <BlueprintOverlay variant="architecture" />

      <div className="relative mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <Reveal
            as="p"
            className="font-mono text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground"
          >
            The platform architecture
          </Reveal>
          <Reveal
            as="h2"
            delay={60}
            className="mt-4 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl"
          >
            Complete brand protection, automated end-to-end.
          </Reveal>
          <Reveal
            as="p"
            delay={120}
            className="mt-4 text-base leading-relaxed text-muted-foreground"
          >
            Detection, evidence, and enforcement share one verifiable chain of custody — built for
            brand teams and IP law firms.
          </Reveal>
        </div>

        {/* Desktop: quadrant layout with SVG connectors to a central engine. */}
        <div ref={ref} className="relative mt-16 hidden lg:block">
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 h-full w-full"
            viewBox="0 0 1000 600"
            preserveAspectRatio="none"
          >
            <g fill="none" stroke="var(--guide-strong)" strokeWidth={1}>
              {Object.values(LINES).map((d, i) => (
                <path
                  key={i}
                  d={d}
                  strokeDasharray="600"
                  strokeDashoffset={inView ? 0 : 600}
                  style={{
                    transition: "stroke-dashoffset 900ms cubic-bezier(.22,1,.36,1)",
                    transitionDelay: `${200 + i * 120}ms`,
                  }}
                />
              ))}
            </g>
            {/* A single mint data packet flows along one connector, once drawn. */}
            <path
              d={LINES.br}
              fill="none"
              stroke="var(--mint, #18c889)"
              strokeWidth={2}
              strokeLinecap="round"
              strokeDasharray="14 586"
              className={inView ? "wf-flow" : undefined}
              style={{ opacity: inView ? 0.9 : 0 }}
            />
          </svg>

          <div className="relative grid grid-cols-3 items-stretch gap-6">
            <ModuleCard m={pick("tl")} delay={200} />
            <div className="row-span-2 flex items-center justify-center">
              <Reveal className="w-full">
                <EngineCard />
              </Reveal>
            </div>
            <ModuleCard m={pick("tr")} delay={280} />
            <ModuleCard m={pick("bl")} delay={360} />
            <ModuleCard m={pick("br")} delay={440} />
          </div>
        </div>

        {/* Mobile / tablet: engine on top, modules stacked in a 2-col grid. */}
        <div className="mt-14 lg:hidden">
          <Reveal>
            <EngineCard />
          </Reveal>
          <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
            {MODULES.map((m, i) => (
              <ModuleCard key={m.title} m={m} delay={i * 70} />
            ))}
          </div>
        </div>

        <Reveal delay={120} className="mt-12 flex justify-center">
          <button
            type="button"
            onClick={openDemo}
            className="group inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-foreground transition-colors hover:text-muted-foreground"
          >
            Review technical architecture
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </button>
        </Reveal>
      </div>
    </section>
  );
}

function EngineCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-foreground/15 bg-foreground p-6 text-center text-background shadow-lg",
        className,
      )}
    >
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-background/10">
        <ShieldCheck className="h-6 w-6" strokeWidth={2} />
      </div>
      <p className="mt-4 font-display text-lg font-extrabold tracking-tight">HAKKIU engine</p>
      <p className="mt-1 text-xs leading-relaxed text-background/70">
        One detection &amp; enforcement core, one chain of custody.
      </p>
      <span
        className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-background/20 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider"
        style={{ color: "var(--mint, #18c889)" }}
      >
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: "var(--mint, #18c889)" }}
        />
        Operational
      </span>
    </div>
  );
}
