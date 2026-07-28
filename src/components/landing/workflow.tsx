import { ShieldCheck, Search, Zap, CheckCircle2, ArrowRight } from "lucide-react";
import { Link } from "@tanstack/react-router";

const WORKFLOW_STEPS = [
  {
    step: "01",
    title: "Connect Brand & Register Trademarks",
    description:
      "Import your brand assets, registered trademarks, logos, and authorized reseller parameters in under 2 minutes.",
    features: ["Instant trademark registry import", "Logo fingerprinting & vector matching", "Authorized seller whitelist"],
  },
  {
    step: "02",
    title: "Continuous AI Monitoring & Verification",
    description:
      "Our AI engines continuously scan global marketplaces, web domains, and social media channels to flag counterfeits.",
    features: ["Real-time threat scoring (0-100%)", "Tamper-evident screenshot capturing", "WHOIS & domain owner lookup"],
  },
  {
    step: "03",
    title: "1-Click Takedown & Resolution Tracking",
    description:
      "Dispatch cryptographically verified takedown notices directly to marketplace legal portals and track resolution.",
    features: ["Automated DMCA & IP notice generation", "Direct API integration with platforms", "Full audit log & ROI reporting"],
  },
];

export function Workflow() {
  return (
    <section id="how" className="relative border-b border-border/60 bg-muted/10 py-24 scroll-mt-14">
      <div className="relative mx-auto max-w-6xl px-6">
        {/* Section Header */}
        <div className="mx-auto max-w-2xl text-center">
          <p className="font-mono text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            HOW TRACEMARK WORKS
          </p>
          <h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl md:text-5xl">
            From threat detection to resolution in 3 simple steps.
          </h2>
          <p className="mt-4 text-base text-muted-foreground sm:text-lg">
            No complex integration required. Deploy automated brand protection in minutes.
          </p>
        </div>

        {/* 3 Step Cards Layout (Vercel Style) */}
        <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-3">
          {WORKFLOW_STEPS.map((item) => (
            <div
              key={item.step}
              className="group relative flex flex-col justify-between rounded-2xl border border-border/80 bg-card p-6 shadow-sm transition-all hover:border-foreground/40 hover:shadow-md"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-3xl font-extrabold tracking-tight text-muted-foreground/60 transition-colors group-hover:text-foreground">
                    {item.step}
                  </span>
                  <span className="h-2 w-2 rounded-full bg-border transition-colors group-hover:bg-emerald-500" />
                </div>
                <h3 className="mt-6 font-display text-xl font-bold tracking-tight text-foreground">
                  {item.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {item.description}
                </p>
              </div>

              <div className="mt-8 border-t border-border/60 pt-4">
                <ul className="space-y-2 text-xs font-medium text-foreground">
                  {item.features.map((feat) => (
                    <li key={feat} className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-14 flex items-center justify-center">
          <Link
            to="/request-demo"
            className="inline-flex items-center gap-2 rounded-lg bg-foreground px-6 py-3 text-xs font-semibold text-background shadow-md transition-all hover:bg-foreground/90"
          >
            Book a Demo
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
