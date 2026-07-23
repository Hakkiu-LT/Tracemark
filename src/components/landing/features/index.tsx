import {
  Activity,
  Sparkles,
  FileCheck,
  Send,
  CheckCircle2,
  Lock,
  ExternalLink,
  ShieldAlert,
  Search,
} from "lucide-react";

export function Features() {
  return (
    <section id="features" className="relative border-b border-border/60 bg-background py-24 scroll-mt-14">
      {/* Background dot pattern */}
      <div
        aria-hidden="true"
        className="vercel-dots-bg pointer-events-none absolute inset-0 opacity-40 [mask-image:radial-gradient(ellipse_70%_70%_at_50%_50%,#000_60%,transparent_100%)]"
      />

      <div className="relative mx-auto max-w-6xl px-6">
        {/* Section Header */}
        <div className="mx-auto max-w-2xl text-center">
          <p className="font-mono text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            THE PLATFORM ARCHITECTURE
          </p>
          <h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl md:text-5xl">
            Complete brand protection, automated end-to-end.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
            Built for enterprise brand protection teams and IP law firms who require speed, legal evidence precision, and scalable enforcement.
          </p>
        </div>

        {/* Vercel Bento Grid Layout */}
        <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-12">
          
          {/* Card 1: 24/7 Multi-Channel Surveillance (Span 7) */}
          <div className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border/80 bg-card p-6 shadow-sm transition-all hover:border-foreground/30 hover:shadow-md lg:col-span-7">
            <div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-muted/50 text-foreground">
                <Activity className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-display text-xl font-bold tracking-tight text-foreground">
                24/7 Multi-Channel Surveillance
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Continuous automated web crawlers scan over 12 global marketplaces, social commerce platforms, app stores, and domain registries around the clock.
              </p>
            </div>

            {/* Static Visual UI Frame */}
            <div className="mt-6 rounded-xl border border-border/60 bg-background p-4 text-xs font-mono">
              <div className="flex items-center justify-between border-b border-border/40 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="font-semibold text-foreground">Live Crawler Stream</span>
                </div>
                <span className="text-[11px] text-muted-foreground">Updated 1s ago</span>
              </div>
              <div className="mt-3 space-y-2 text-[11px]">
                <div className="flex items-center justify-between rounded bg-muted/40 p-2">
                  <span className="text-muted-foreground">Amazon US/EU/JP</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">● 14,290 listings scanned/min</span>
                </div>
                <div className="flex items-center justify-between rounded bg-muted/40 p-2">
                  <span className="text-muted-foreground">Shopify & Web Domains</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">● 8,120 endpoints scanned/min</span>
                </div>
                <div className="flex items-center justify-between rounded bg-muted/40 p-2">
                  <span className="text-muted-foreground">Instagram & TikTok Ads</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">● 3,840 profiles checked/min</span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: AI Visual & Trademark Matcher (Span 5) */}
          <div className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border/80 bg-card p-6 shadow-sm transition-all hover:border-foreground/30 hover:shadow-md lg:col-span-5">
            <div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-muted/50 text-foreground">
                <Sparkles className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-display text-xl font-bold tracking-tight text-foreground">
                AI Visual & Text Matcher
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Computer vision & NLP models compare listings against your official trademark registry to detect modified logos, typo-squatting, and evasive copy.
              </p>
            </div>

            {/* Static Visual UI Frame */}
            <div className="mt-6 rounded-xl border border-border/60 bg-background p-4 text-xs">
              <div className="flex items-center justify-between border-b border-border/40 pb-2">
                <span className="font-mono text-[11px] text-muted-foreground">MATCH CONFIDENCE</span>
                <span className="rounded-full bg-rose-500/15 px-2 py-0.5 font-mono text-[10px] font-bold text-rose-600 dark:text-rose-400">
                  &gt;99% CONFIDENCE
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3 font-mono text-[11px]">
                <div className="flex-1 rounded border border-emerald-500/30 bg-emerald-500/5 p-2.5 text-center">
                  <p className="text-[10px] text-muted-foreground">REGISTERED MARK</p>
                  <p className="mt-1 font-bold text-foreground">"Tracemark"</p>
                </div>
                <span className="text-muted-foreground font-bold">VS</span>
                <div className="flex-1 rounded border border-rose-500/30 bg-rose-500/5 p-2.5 text-center">
                  <p className="text-[10px] text-muted-foreground font-sans">DETECTED COUNTERFEIT</p>
                  <p className="mt-1 font-bold text-rose-600 dark:text-rose-400">"Trace-Mark-Shop"</p>
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: Forensic Evidence Dossier (Span 5) */}
          <div className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border/80 bg-card p-6 shadow-sm transition-all hover:border-foreground/30 hover:shadow-md lg:col-span-5">
            <div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-muted/50 text-foreground">
                <FileCheck className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-display text-xl font-bold tracking-tight text-foreground">
                Forensic Evidence Dossiers
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Automatically archives high-resolution screenshots, page HTML, WHOIS registration details, and cryptographic timestamps ready for court or legal review.
              </p>
            </div>

            {/* Static Visual UI Frame */}
            <div className="mt-6 rounded-xl border border-border/60 bg-background p-4 font-mono text-xs space-y-2">
              <div className="flex justify-between text-[11px]">
                <span className="text-muted-foreground">Screenshot SHA-256:</span>
                <span className="font-semibold text-foreground">8f92a4b...c19</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-muted-foreground">WHOIS Registrar:</span>
                <span className="text-foreground">NameCheap, Inc.</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-muted-foreground">Cryptographic Record:</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Immutable Seal ✔</span>
              </div>
            </div>
          </div>

          {/* Card 4: 1-Click Automated Enforcement (Span 7) */}
          <div className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border/80 bg-card p-6 shadow-sm transition-all hover:border-foreground/30 hover:shadow-md lg:col-span-7">
            <div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-muted/50 text-foreground">
                <Send className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-display text-xl font-bold tracking-tight text-foreground">
                1-Click Marketplace Enforcement
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Direct API integrations with Amazon Brand Registry, Shopify Takedown Portals, Google DMCA, and registrar notice dispatches to remove infringing content immediately.
              </p>
            </div>

            {/* Static Visual UI Frame */}
            <div className="mt-6 rounded-xl border border-border/60 bg-background p-4 text-xs font-mono">
              <div className="flex items-center justify-between border-b border-border/40 pb-2">
                <span className="font-semibold text-foreground">Takedown Dispatch Engine</span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">API ACTIVE</span>
              </div>
              <div className="mt-3 flex items-center justify-between rounded bg-muted/40 p-2.5">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span>Amazon IP Takedown Submitted</span>
                </div>
                <span className="font-bold text-foreground">Case #AMZ-9941</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
