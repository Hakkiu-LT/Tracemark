import {
  ArrowRight,
  UploadCloud,
  ScanLine,
  Gavel,
  CheckCircle2,
  BadgeCheck,
  Upload,
  FileText,
  Download,
  type LucideIcon,
} from "lucide-react";
import { RainbowButton } from "@/components/ui/rainbow-button";
import { BlueprintOverlay } from "./blueprint";
import { Reveal } from "./reveal";
import { useLeadModals } from "./lead-modals";

const MINT = "var(--mint, #18c889)";

type Step = {
  step: string;
  icon: LucideIcon;
  title: string;
  description: string;
  duration: string;
};

const STEPS: Step[] = [
  {
    step: "01",
    icon: UploadCloud,
    title: "Connect your brand",
    description:
      "Import registered trademarks, logos, and authorized sellers in minutes — no engineering required.",
    duration: "Day one",
  },
  {
    step: "02",
    icon: ScanLine,
    title: "Detect and verify",
    description:
      "AI continuously scans channels, scores each match, and captures tamper-evident evidence.",
    duration: "Continuous",
  },
  {
    step: "03",
    icon: Gavel,
    title: "Enforce and resolve",
    description:
      "Dispatch cryptographically verified notices to legal portals and track every case to close.",
    duration: "Same day",
  },
];

/**
 * Per-step preview panel — a small, solid mock of what the product shows at that
 * stage (assets imported → live scan → sealed legal packet). Decorative only.
 */
function StepPreview({ step }: { step: string }) {
  if (step === "01") {
    return (
      <div className="flex flex-col gap-2" aria-hidden="true">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Brand assets
          </span>
          <span className="flex items-center gap-1.5 font-mono text-[10px]" style={{ color: MINT }}>
            <CheckCircle2 className="h-3 w-3" />3 uploaded
          </span>
        </div>
        <div className="flex items-center gap-2 rounded-md border border-border/70 bg-background px-2.5 py-2">
          <Upload className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-mono text-[11px] text-foreground">hakkiu-wordmark.svg</span>
        </div>
        <div className="flex items-center justify-between rounded-md border border-border/70 bg-background px-2.5 py-2">
          <span className="flex items-center gap-2 font-mono text-[11px] text-foreground">
            <BadgeCheck className="h-3.5 w-3.5" style={{ color: MINT }} />
            Reg. 7,812,903
          </span>
          <span className="font-mono text-[10px] font-semibold uppercase tracking-wider" style={{ color: MINT }}>
            Active
          </span>
        </div>
      </div>
    );
  }

  if (step === "02") {
    return (
      <div className="flex flex-col gap-2" aria-hidden="true">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Live scan
          </span>
          <span className="font-mono text-[10px] text-muted-foreground">1,842 channels</span>
        </div>
        <div className="relative h-9 overflow-hidden rounded-md border border-border/70 bg-background">
          <div
            className="hakkiu-scan-x absolute inset-y-0 left-0 w-1/4"
            style={{
              background: `linear-gradient(90deg, transparent, color-mix(in srgb, ${MINT} 35%, transparent), transparent)`,
            }}
          />
        </div>
        <div className="flex items-center justify-between rounded-md border border-border/70 bg-background px-2.5 py-2">
          <span className="font-mono text-[11px] text-foreground">hakku-official.store</span>
          <span className="font-mono text-[10px] font-semibold uppercase tracking-wider" style={{ color: MINT }}>
            99.4%
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2" aria-hidden="true">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Legal packet
        </span>
        <span className="font-mono text-[10px] font-semibold uppercase tracking-wider" style={{ color: MINT }}>
          Verified
        </span>
      </div>
      <div className="flex items-center gap-2 rounded-md border border-border/70 bg-background px-2.5 py-2">
        <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate font-mono text-[11px] text-foreground">
          HAKKIU_Takedown_2025-05-18.pdf
        </span>
        <Download className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </div>
      <div
        className="flex items-center justify-between rounded-md border px-2.5 py-2"
        style={{
          borderColor: `color-mix(in srgb, ${MINT} 35%, transparent)`,
          backgroundColor: `color-mix(in srgb, ${MINT} 10%, transparent)`,
        }}
      >
        <span className="font-mono text-[11px]" style={{ color: MINT }}>
          Amazon marketplace
        </span>
        <span className="font-mono text-[10px] font-semibold uppercase tracking-wider" style={{ color: MINT }}>
          Confirmed
        </span>
      </div>
    </div>
  );
}

export function Workflow() {
  const { openDemo, openSales } = useLeadModals();

  return (
    <section
      id="how"
      className="technical-paper relative scroll-mt-16 border-b border-border/60 py-20 md:py-24"
    >
      <BlueprintOverlay variant="how" />

      <div className="relative mx-auto max-w-6xl px-6">
        <div className="max-w-2xl">
          <Reveal
            as="p"
            className="font-mono text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground"
          >
            How HAKKIU works
          </Reveal>
          <Reveal
            as="h2"
            delay={60}
            className="mt-4 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl"
          >
            From brand asset to enforced takedown.
          </Reveal>
          <Reveal as="p" delay={120} className="mt-4 text-base text-muted-foreground">
            A continuous workflow your team can audit at every step.
          </Reveal>
          <Reveal
            as="h3"
            delay={180}
            className="mt-8 font-display text-xl font-bold tracking-tight text-foreground"
          >
            How does HAKKIU turn a detection into a takedown?
          </Reveal>
          <Reveal as="p" delay={240} className="mt-3 max-w-xl text-base text-muted-foreground">
            You connect your trademarks, logos and authorized sellers once. From there AI scans
            your channels continuously, scores every match and captures tamper-evident evidence —
            then a DMCA or trademark notice goes out to the marketplace or registrar with that
            dossier attached, and each case is tracked to resolution.
          </Reveal>
        </div>

        {/* Process datum: a horizontal line links the three stations on desktop. */}
        <div className="relative mt-16">
          <div
            aria-hidden="true"
            className="absolute inset-x-8 top-5 hidden h-px bg-border md:block"
          />
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              return (
                <Reveal
                  key={s.step}
                  delay={i * 90}
                  className="group relative flex flex-col rounded-2xl border border-border/80 bg-card p-6 shadow-sm transition-all hover:-translate-y-1 hover:border-foreground/40 hover:shadow-md"
                >
                  {/* Ghost step number */}
                  <span className="pointer-events-none absolute right-4 top-2 select-none font-display text-6xl font-extrabold leading-none tracking-tight text-foreground/[0.04]">
                    {s.step}
                  </span>

                  <div className="relative flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-background text-foreground shadow-sm transition-colors group-hover:border-foreground/30">
                        <Icon className="h-5 w-5" strokeWidth={2} />
                      </span>
                      <span className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        Step {s.step}
                      </span>
                    </div>
                    <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      {s.duration}
                    </span>
                  </div>

                  <h3 className="relative mt-5 font-display text-xl font-bold tracking-tight text-foreground">
                    {s.title}
                  </h3>
                  <p className="relative mt-2.5 text-sm leading-relaxed text-muted-foreground">
                    {s.description}
                  </p>

                  {/* Stage preview — what the product shows at this step. */}
                  <div className="relative mt-6 rounded-xl border border-border/60 bg-muted/30 p-3.5">
                    <StepPreview step={s.step} />
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>

        {/* Conversion after the sequence */}
        <Reveal delay={120} className="mt-12 flex flex-wrap items-center justify-center gap-3">
          <RainbowButton
            type="button"
            onClick={openDemo}
            className="gap-2 rounded-lg px-6 text-sm font-semibold shadow-md"
          >
            Book a demo
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </RainbowButton>
          <button
            type="button"
            onClick={openSales}
            className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:border-foreground/40 hover:bg-muted"
          >
            Talk to sales
          </button>
        </Reveal>
      </div>
    </section>
  );
}
