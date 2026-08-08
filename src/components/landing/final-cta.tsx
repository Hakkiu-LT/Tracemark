import { ArrowRight, Check, CalendarCheck, MessageSquare } from "lucide-react";
import { CompanyLogo } from "@/components/company-logo";
import { RainbowButton } from "@/components/ui/rainbow-button";
import { BlueprintOverlay } from "./blueprint";
import { Reveal } from "./reveal";
import { useLeadModals } from "./lead-modals";

const TRUST = ["No setup fee", "Tailored to your channels", "NDA available"];

export function FinalCTA() {
  const { openDemo, openSales } = useLeadModals();

  return (
    <section className="technical-paper technical-paper--dark relative overflow-hidden border-b border-white/10 py-20 md:py-28">
      <BlueprintOverlay variant="cta" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 55% 60% at 30% 40%, rgba(24,200,137,0.07), transparent 70%)",
        }}
      />

      <div className="relative mx-auto grid max-w-6xl grid-cols-1 gap-12 px-6 lg:grid-cols-2 lg:items-center">
        {/* Message */}
        <div>
          <Reveal
            as="p"
            className="font-mono text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400"
          >
            Ready to deploy brand defense?
          </Reveal>
          <Reveal
            as="h2"
            delay={60}
            className="mt-4 font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl"
          >
            Choose the next step for your brand.
          </Reveal>
          <Reveal
            as="p"
            delay={120}
            className="mt-5 max-w-md text-base leading-relaxed text-slate-300/80"
          >
            See HAKKIU in action, or speak directly with a specialist about integrations,
            procurement, and legal workflows.
          </Reveal>
          <Reveal delay={180} className="mt-8">
            <CompanyLogo className="h-6 text-white/90" />
          </Reveal>
        </div>

        {/* Two paths */}
        <div className="flex flex-col gap-4">
          {/* Primary — book a demo (mint-highlighted path) */}
          <Reveal
            delay={80}
            className="rounded-2xl border border-[rgba(24,200,137,0.4)] bg-[rgba(24,200,137,0.05)] p-6"
          >
            <div className="flex items-start gap-4">
              <span
                className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: "var(--mint, #18c889)" }}
              >
                <Check className="h-3.5 w-3.5 text-[#090d13]" strokeWidth={3} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-display text-lg font-bold tracking-tight text-white">
                    See the platform in action
                  </h3>
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(24,200,137,0.4)] px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider"
                    style={{ color: "var(--mint, #18c889)" }}
                  >
                    <CalendarCheck className="h-3 w-3" />
                    ~1 business day
                  </span>
                </div>
                <p className="mt-1.5 text-sm text-slate-300/80">
                  A focused 30-minute walkthrough tailored to your channels.
                </p>
                <RainbowButton
                  type="button"
                  onClick={openDemo}
                  className="mt-4 w-full gap-2 rounded-lg px-5 text-sm font-semibold sm:w-auto"
                >
                  Book a demo
                  <ArrowRight className="h-4 w-4" />
                </RainbowButton>
              </div>
            </div>
          </Reveal>

          {/* Secondary — talk to sales */}
          <Reveal delay={140} className="rounded-2xl border border-white/12 bg-white/[0.03] p-6">
            <div className="flex items-start gap-4">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/20 text-slate-300">
                <MessageSquare className="h-3 w-3" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="font-display text-lg font-bold tracking-tight text-white">
                  Discuss requirements first
                </h3>
                <p className="mt-1.5 text-sm text-slate-300/80">
                  For security, procurement, integrations, or legal questions.
                </p>
                <button
                  type="button"
                  onClick={openSales}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:border-white/40 hover:bg-white/10 sm:w-auto"
                >
                  Talk to sales
                </button>
              </div>
            </div>
          </Reveal>

          {/* Trust bar */}
          <Reveal delay={200} className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-2">
            {TRUST.map((t) => (
              <span key={t} className="flex items-center gap-1.5 text-xs text-slate-400">
                <Check
                  className="h-3.5 w-3.5"
                  style={{ color: "var(--mint, #18c889)" }}
                  strokeWidth={2.5}
                />
                {t}
              </span>
            ))}
          </Reveal>
        </div>
      </div>
    </section>
  );
}
