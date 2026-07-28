import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Search,
  Lock,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { TalkToSalesModal } from "./talk-to-sales-modal";

const stats = [
  { value: "24/7", label: "Surveillance" },
  { value: "12", label: "Marketplaces & Socials" },
  { value: ">99%", label: "AI Detection Accuracy" },
  { value: "1-Click", label: "Takedown Notice Preparation" },
];

export function HeroV3() {
  const [salesOpen, setSalesOpen] = useState(false);

  return (
    <>
      <TalkToSalesModal open={salesOpen} onOpenChange={setSalesOpen} />
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
            <span className="font-semibold text-foreground">HAKKIU AI 2.0</span>
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
              <Link to="/request-demo" className="flex items-center gap-2">
                Book a demo
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          <p className="mt-4 text-xs text-muted-foreground">
            Already have questions?{" "}
            <button
              onClick={() => setSalesOpen(true)}
              className="font-medium text-foreground underline underline-offset-2 hover:no-underline cursor-pointer"
            >
              Talk to sales →
            </button>
          </p>

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
                  <span>app.hakkiu.com/monitoring</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    LIVE ALERTS
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
                        Live Infringement Alert Feed
                      </span>
                    </div>
                    <span className="text-xs font-mono font-medium text-emerald-600 dark:text-emerald-400">
                      4 active cases flagged
                    </span>
                  </div>

                  {/* Listing Cards */}
                  <div className="space-y-2.5 font-sans">
                    {/* Item 1 - Amazon */}
                    <div className="flex items-center gap-3 rounded-lg border border-rose-500/30 bg-rose-500/5 p-3 text-xs transition-all hover:border-rose-500/50">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold text-xs">
                        AM
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700 dark:text-rose-300 uppercase">
                            HIGH RISK
                          </span>
                          <span className="inline-flex items-center gap-0.5 rounded border border-border/50 bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                            🇺🇸 US
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            • 2m ago
                          </span>
                          <span className="rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400 capitalize">
                            flagged
                          </span>
                        </div>
                        <p className="mt-1 truncate font-medium text-foreground text-xs">
                          https://www.amazon.com/dp/B089X2KL9
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground font-mono mt-0.5">
                          Match: Counterfeit (Score: 99.4%) • Seller: ApexDiscounts
                        </p>
                      </div>
                    </div>

                    {/* Item 2 - Shopify */}
                    <div className="flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs transition-all hover:border-amber-500/50">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                        SH
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700 dark:text-rose-300 uppercase">
                            HIGH RISK
                          </span>
                          <span className="inline-flex items-center gap-0.5 rounded border border-border/50 bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                            🇬🇧 GB
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            • 8m ago
                          </span>
                          <span className="rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400 capitalize">
                            flagged
                          </span>
                        </div>
                        <p className="mt-1 truncate font-medium text-foreground text-xs">
                          https://get-hakkiu-official-shop.com
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground font-mono mt-0.5">
                          Match: Trademark Typosquatting (Score: 94.2%)
                        </p>
                      </div>
                    </div>

                    {/* Item 3 - Instagram */}
                    <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/20 p-3 text-xs">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-pink-500/30 bg-pink-500/10 text-pink-600 dark:text-pink-400 font-bold text-xs">
                        IG
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300 uppercase">
                            MEDIUM
                          </span>
                          <span className="inline-flex items-center gap-0.5 rounded border border-border/50 bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                            🇪🇺 EU
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            • 15m ago
                          </span>
                          <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 capitalize">
                            takedown_sent
                          </span>
                        </div>
                        <p className="mt-1 truncate font-medium text-foreground text-xs">
                          instagram.com/p/C9x8a2b1c
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground font-mono mt-0.5">
                          Match: Brand Asset Usage (Score: 88.0%)
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column: Case Enforcement Details */}
                <div className="p-5 lg:col-span-5 bg-muted/10 space-y-4">
                  <div className="flex items-center justify-between border-b border-border/40 pb-3">
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
                        Case #case_8f9a2b1c
                      </span>
                      <span className="text-[11px] text-muted-foreground font-mono">Mark: HAKKIU®</span>
                    </div>
                    <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                      Ready for Takedown
                    </span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between items-center rounded bg-background border border-border/50 p-2 font-mono">
                      <span className="text-muted-foreground text-[11px]">Platform:</span>
                      <span className="font-semibold text-foreground text-[11px]">Amazon US</span>
                    </div>
                    <div className="flex justify-between items-center rounded bg-background border border-border/50 p-2 font-mono">
                      <span className="text-muted-foreground text-[11px]">Risk Score:</span>
                      <span className="text-rose-600 dark:text-rose-400 font-semibold text-[11px]">99.4% (High Risk)</span>
                    </div>
                    <div className="flex justify-between items-center rounded bg-background border border-border/50 p-2 font-mono">
                      <span className="text-muted-foreground text-[11px]">Evidence Hash:</span>
                      <span className="text-foreground text-[11px]">sha256:e3b0c44...</span>
                    </div>
                  </div>

                  <div className="rounded-lg border border-border/60 bg-background p-3.5 text-xs space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground">1-Click Legal Takedown</span>
                      <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                        Auto-Form Fill
                      </span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                      Dispatches formatted DMCA notice & evidence bundle directly to platform IP Portal.
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
    </>
  );
}
