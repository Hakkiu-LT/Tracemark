import {
  ArrowRight,
  UploadCloud,
  ScanLine,
  Gavel,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";
import { RainbowButton } from "@/components/ui/rainbow-button";
import { BlueprintOverlay } from "./blueprint";
import { Reveal } from "./reveal";
import { useLeadModals } from "./lead-modals";

type Step = {
  step: string;
  icon: LucideIcon;
  title: string;
  description: string;
  detail: string[];
};

const STEPS: Step[] = [
  {
    step: "01",
    icon: UploadCloud,
    title: "Connect your brand",
    description:
      "Import registered trademarks, logos, and authorized sellers in minutes — no engineering required.",
    detail: ["Trademark registry import", "Logo fingerprinting", "Authorized-seller allowlist"],
  },
  {
    step: "02",
    icon: ScanLine,
    title: "Detect and verify",
    description:
      "AI continuously scans channels, scores each match, and captures tamper-evident evidence.",
    detail: ["Real-time match scoring", "Sealed screenshot + HTML", "WHOIS & owner lookup"],
  },
  {
    step: "03",
    icon: Gavel,
    title: "Enforce and resolve",
    description:
      "Dispatch cryptographically verified notices to legal portals and track every case to close.",
    detail: [
      "Automated DMCA & IP notices",
      "Direct platform dispatch",
      "Full audit log & reporting",
    ],
  },
];

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

                  <div className="relative flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-background text-foreground shadow-sm transition-colors group-hover:border-foreground/30">
                      <Icon className="h-5 w-5" strokeWidth={2} />
                    </span>
                    <span className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Step {s.step}
                    </span>
                  </div>

                  <h3 className="relative mt-5 font-display text-xl font-bold tracking-tight text-foreground">
                    {s.title}
                  </h3>
                  <p className="relative mt-2.5 text-sm leading-relaxed text-muted-foreground">
                    {s.description}
                  </p>

                  <ul className="relative mt-6 space-y-2 border-t border-border/60 pt-4 text-xs font-medium text-foreground">
                    {s.detail.map((d) => (
                      <li key={d} className="flex items-center gap-2">
                        <CheckCircle2
                          className="h-3.5 w-3.5 shrink-0"
                          style={{ color: "var(--mint, #18c889)" }}
                        />
                        {d}
                      </li>
                    ))}
                  </ul>
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
