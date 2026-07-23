import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  ShieldCheck,
  Zap,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Search,
  Lock,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const stats = [
  { value: "24/7", label: "Surveillance" },
  { value: "12", label: "Marketplaces & Socials" },
  { value: ">99%", label: "AI Detection Accuracy" },
  { value: "1-Click", label: "Takedown Notice Preparation" },
];

export function HeroV3() {
  return (
    <section className="relative flex flex-col items-center justify-center overflow-hidden border-b border-border/60 bg-background pt-24 pb-16 md:pt-32 md:pb-24">
      {/* Vercel geometric grid background texture with radial gradient mask */}
      <div
        aria-hidden="true"
        className="vercel-grid-bg pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_60%_50%_at_50%_30%,#000_70%,transparent_100%)] opacity-70"
      />

      <div className="relative mx-auto flex w-full max-w-6xl flex-col items-center px-6 text-center">
        {/* Top Badge / Release Pill */}
        <Link
          to="/landing"
          hash="features"
          className="group inline-flex items-center gap-2 rounded-full border border-border/80 bg-muted/50 px-3.5 py-1 text-xs font-medium text-muted-foreground backdrop-blur-md transition-all hover:border-foreground/30 hover:bg-muted"
        >
          <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-semibold text-foreground">Tracemark AI 2.0</span>
          <span className="text-border">|</span>
          <span>Next-Gen Counterfeit Enforcement Engine</span>
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </Link>

        {/* Main Headline */}
        <h1 className="mt-8 max-w-4xl font-display text-4xl font-extrabold tracking-tight text-foreground sm:text-6xl md:text-7xl lg:text-[5rem] leading-[1.05]">
          Protect your brand <br className="hidden sm:inline" />
          <span className="bg-gradient-to-r from-foreground via-foreground/90 to-foreground/60 bg-clip-text text-transparent">
            at internet speed.
          </span>
        </h1>

        {/* Subtitle */}
        <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg md:text-xl">
          Automated 24/7 marketplace monitoring, AI-powered counterfeit detection, and 1-click legal takedowns built for modern brand teams and IP law firms.
        </p>

        {/* Action Buttons */}
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Button
            asChild
            size="lg"
            className="h-12 rounded-lg bg-foreground px-7 text-sm font-semibold text-background shadow-md transition-all hover:bg-foreground/90 hover:shadow-lg cursor-pointer"
          >
            <Link to="/auth/sign-up" className="flex items-center gap-2">
              Start Free Trial
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>

          <Button
            asChild
            size="lg"
            variant="outline"
            className="h-12 rounded-lg border-border/80 bg-background px-7 text-sm font-medium text-foreground transition-all hover:bg-muted cursor-pointer"
          >
            <Link to="/plans" className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-emerald-500" />
              Compare Plans
            </Link>
          </Button>
        </div>

        {/* Quick Trust Highlights */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> No setup fee
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Instant domain & marketplace scan
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Automated DMCA & trademark notices
          </span>
        </div>

        {/* ── MAIN HERO VISUAL: Clean Static UI Window Frame (AI Scanable & Ultra Fast) ── */}
        <div className="mt-14 w-full max-w-5xl rounded-2xl border border-border/80 bg-card p-2 shadow-2xl transition-all">
          <div className="rounded-xl border border-border/60 bg-background overflow-hidden text-left font-sans">
            {/* Window Top Titlebar */}
            <div className="flex h-11 items-center justify-between border-b border-border/60 bg-muted/40 px-4">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-rose-500/80" />
                <div className="h-3 w-3 rounded-full bg-amber-500/80" />
                <div className="h-3 w-3 rounded-full bg-emerald-500/80" />
              </div>
              <div className="flex items-center gap-2 rounded-md border border-border/60 bg-background px-3 py-1 text-xs text-muted-foreground font-mono">
                <Lock className="h-3 w-3 text-emerald-500" />
                <span>app.tracemark.ai/live-monitoring</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  ACTIVE SURVEILLANCE
                </span>
              </div>
            </div>

            {/* Dashboard Visual Grid Content */}
            <div className="grid grid-cols-1 divide-y divide-border/60 lg:grid-cols-12 lg:divide-y-0 lg:divide-x">
              {/* Left Column: Monitored Channels Feed */}
              <div className="p-5 lg:col-span-7 space-y-4">
                <div className="flex items-center justify-between border-b border-border/40 pb-3">
                  <div className="flex items-center gap-2">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Real-Time Infringement Detections
                    </span>
                  </div>
                  <span className="text-xs font-mono font-medium text-emerald-600 dark:text-emerald-400">
                    4 suspicious listings flagged
                  </span>
                </div>

                {/* Listing Cards */}
                <div className="space-y-3 font-sans">
                  {/* Item 1 */}
                  <div className="flex items-start justify-between rounded-lg border border-rose-500/30 bg-rose-500/5 p-3 text-xs transition-all hover:border-rose-500/50">
                    <div className="flex items-start gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400">
                        <AlertTriangle className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 font-medium text-foreground">
                          <span>Amazon US</span>
                          <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700 dark:text-rose-300">
                            Counterfeit (99.4% match)
                          </span>
                        </div>
                        <p className="mt-1 text-muted-foreground font-mono text-[11px]">
                          ASIN: B089X2KL9 | Seller: ApexDiscounts_Store
                        </p>
                      </div>
                    </div>
                    <span className="font-mono text-[10px] text-muted-foreground">2m ago</span>
                  </div>

                  {/* Item 2 */}
                  <div className="flex items-start justify-between rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs transition-all hover:border-amber-500/50">
                    <div className="flex items-start gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400">
                        <Sparkles className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 font-medium text-foreground">
                          <span>Shopify Domain</span>
                          <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                            Trademark Typosquatting
                          </span>
                        </div>
                        <p className="mt-1 text-muted-foreground font-mono text-[11px]">
                          URL: get-tracemark-official-shop.com
                        </p>
                      </div>
                    </div>
                    <span className="font-mono text-[10px] text-muted-foreground">8m ago</span>
                  </div>

                  {/* Item 3 */}
                  <div className="flex items-start justify-between rounded-lg border border-border/60 bg-muted/20 p-3 text-xs">
                    <div className="flex items-start gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                        <ShieldCheck className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 font-medium text-foreground">
                          <span>Instagram Ads</span>
                          <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                            Takedown Dispatched
                          </span>
                        </div>
                        <p className="mt-1 text-muted-foreground font-mono text-[11px]">
                          Handle: @cheap_tracemark_outlet
                        </p>
                      </div>
                    </div>
                    <span className="font-mono text-[10px] text-muted-foreground">15m ago</span>
                  </div>
                </div>
              </div>

              {/* Right Column: Case Details & Takedown Action */}
              <div className="p-5 lg:col-span-5 bg-muted/10 space-y-4">
                <div className="flex items-center justify-between border-b border-border/40 pb-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Evidence Dossier #TRC-8942
                  </span>
                  <span className="rounded-full bg-foreground px-2 py-0.5 text-[10px] font-semibold text-background">
                    Ready to Enforce
                  </span>
                </div>

                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between rounded bg-muted/40 p-2 font-mono">
                    <span className="text-muted-foreground">Target URL:</span>
                    <span className="font-semibold text-foreground">amazon.com/dp/B089X...</span>
                  </div>
                  <div className="flex justify-between rounded bg-muted/40 p-2 font-mono">
                    <span className="text-muted-foreground">Cryptographic Hash:</span>
                    <span className="text-foreground">sha256:e3b0c44298fc...</span>
                  </div>
                  <div className="flex justify-between rounded bg-muted/40 p-2 font-mono">
                    <span className="text-muted-foreground">DMCA Payload:</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Verified Legal Packet</span>
                  </div>
                </div>

                <div className="rounded-lg border border-border/60 bg-background p-3.5 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">Automated Enforcement</span>
                    <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400">1-Click Dispatch</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    Submits formal copyright/trademark takedown directly to Amazon Legal IP Portal with cryptographically hashed evidence.
                  </p>
                  <Button size="sm" className="w-full h-8 gap-1.5 bg-foreground text-background text-xs font-semibold hover:bg-foreground/90 cursor-pointer">
                    <FileText className="h-3.5 w-3.5" />
                    Submit 1-Click Takedown
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Monitored Metrics Footer Strip */}
        <div className="mt-14 w-full border-t border-border/60 pt-8">
          <dl className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="flex flex-col items-center">
                <dd className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  {s.value}
                </dd>
                <dt className="mt-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {s.label}
                </dt>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
