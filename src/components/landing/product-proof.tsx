import { ArrowRight, ScanSearch, FileCheck2, Gavel } from "lucide-react";
import { BlueprintOverlay } from "./blueprint";
import { Reveal } from "./reveal";
import { useLeadModals } from "./lead-modals";

/**
 * Product proof — narrates the single continuous move the workspace makes:
 * detect → verify → enforce. Explains the window shown in the hero rather than
 * repeating it, then closes with the real monitoring metrics.
 */

const FLOW = [
  {
    icon: ScanSearch,
    step: "Detect",
    title: "A listing is flagged",
    body: "AI scans marketplaces, social channels, and domains and surfaces a suspected infringement with a match score.",
  },
  {
    icon: FileCheck2,
    step: "Verify",
    title: "Evidence is sealed",
    body: "A tamper-evident screenshot, page HTML, and WHOIS record are captured and cryptographically hashed into a dossier.",
  },
  {
    icon: Gavel,
    step: "Enforce",
    title: "A takedown is filed",
    body: "A formal trademark or DMCA notice is dispatched to the marketplace legal portal, and resolution is tracked to close.",
  },
];

const METRICS = [
  { value: "24/7", label: "Surveillance" },
  { value: "12", label: "Markets & socials" },
  { value: ">99%", label: "Detection accuracy" },
  { value: "1-click", label: "Takedown dispatch" },
];

export function ProductProof() {
  const { openDemo } = useLeadModals();

  return (
    <section
      id="proof"
      className="technical-paper relative border-b border-border/60 py-20 md:py-24"
    >
      <BlueprintOverlay variant="proof" />

      <div className="relative mx-auto max-w-6xl px-6">
        {/* Header */}
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <Reveal
              as="p"
              className="font-mono text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground"
            >
              Live enforcement
            </Reveal>
            <Reveal
              as="h2"
              delay={60}
              className="mt-4 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl"
            >
              See an infringement move from detection to takedown.
            </Reveal>
            <Reveal as="p" delay={120} className="mt-4 max-w-xl text-base text-muted-foreground">
              One workspace connects AI detection, evidence capture, legal review, and marketplace
              enforcement — no tools to stitch together.
            </Reveal>
          </div>

          <Reveal delay={160}>
            <button
              type="button"
              onClick={openDemo}
              className="group inline-flex shrink-0 cursor-pointer items-center gap-2 text-sm font-semibold text-foreground transition-colors hover:text-muted-foreground"
            >
              Explore the platform
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          </Reveal>
        </div>

        {/* Detect → verify → enforce flow */}
        <div className="mt-14 grid grid-cols-1 gap-5 md:grid-cols-3">
          {FLOW.map((f, i) => {
            const Icon = f.icon;
            return (
              <Reveal
                key={f.step}
                delay={i * 70}
                className="relative rounded-2xl border border-border/80 bg-card p-6 shadow-sm"
              >
                {/* Connector arrow between steps on desktop */}
                {i < FLOW.length - 1 && (
                  <ArrowRight
                    aria-hidden="true"
                    className="absolute -right-4 top-1/2 hidden h-5 w-5 -translate-y-1/2 text-border md:block"
                  />
                )}
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-muted/40 text-foreground">
                    <Icon className="h-5 w-5" strokeWidth={2} />
                  </span>
                  <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    {`0${i + 1} · ${f.step}`}
                  </span>
                </div>
                <h3 className="mt-5 font-display text-lg font-bold tracking-tight text-foreground">
                  {f.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
              </Reveal>
            );
          })}
        </div>

        {/* Monitoring metrics */}
        <Reveal delay={120} className="mt-14 border-t border-border/60 pt-8">
          <dl className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            {METRICS.map((m) => (
              <div key={m.label} className="flex flex-col items-center text-center">
                <dd className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  {m.value}
                </dd>
                <dt className="mt-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  {m.label}
                </dt>
              </div>
            ))}
          </dl>
        </Reveal>
      </div>
    </section>
  );
}
