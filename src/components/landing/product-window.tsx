import { AlertTriangle, Sparkles, ShieldCheck, Search, Lock, FileText } from "lucide-react";
import { HakkiuLogo } from "@/components/hakkiu-logo";
import { cn } from "@/lib/utils";

/**
 * The live-monitoring product window — a solid, high-contrast mock of the
 * HAKKIU app (real-time detections on the left, an evidence dossier + 1-click
 * takedown on the right). Anchored in the hero. Solid surfaces only: the technical-paper dot grid
 * must never bleed into it. The whole mock is decorative — `aria-hidden` — so
 * the fake in-product buttons are not exposed to assistive tech or the tab order.
 *
 * `scan` runs a single mint scan line down the window once, on reveal (disabled
 * under prefers-reduced-motion via the .hakkiu-scan CSS).
 */

const DETECTIONS = [
  {
    channel: "Amazon US",
    tone: "rose" as const,
    icon: AlertTriangle,
    badge: "Counterfeit · 99.4% match",
    meta: "ASIN B089X2KL9 · seller ApexDiscounts_Store",
    time: "2m ago",
  },
  {
    channel: "Shopify domain",
    tone: "amber" as const,
    icon: Sparkles,
    badge: "Trademark typosquatting",
    meta: "get-hakkiu-official-shop.com",
    time: "8m ago",
  },
  {
    channel: "Instagram ads",
    tone: "mint" as const,
    icon: ShieldCheck,
    badge: "Takedown dispatched",
    meta: "@cheap_hakkiu_outlet",
    time: "15m ago",
  },
];

const TONES = {
  rose: {
    card: "border-rose-500/30 bg-rose-500/5",
    chip: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
    icon: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  },
  amber: {
    card: "border-amber-500/30 bg-amber-500/5",
    chip: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    icon: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  mint: {
    card: "border-emerald-500/30 bg-emerald-500/5",
    chip: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    icon: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
};

const DOSSIER = [
  { label: "Target URL", value: "amazon.com/dp/B089X…", mono: true },
  { label: "Evidence hash", value: "sha256:9f2c1a7be40d…", mono: true },
  { label: "DMCA payload", value: "Verified legal packet", mint: true },
];

export function ProductWindow({ scan = false, className }: { scan?: boolean; className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("w-full rounded-2xl border border-border/80 bg-card p-2 shadow-2xl", className)}
    >
      <div className="relative overflow-hidden rounded-xl border border-border/60 bg-background text-left">
        {/* Single scan line, once, on reveal. */}
        {scan && (
          <div
            className="hakkiu-scan pointer-events-none absolute inset-x-0 top-0 z-20 h-16"
            style={{
              background:
                "linear-gradient(to bottom, transparent, color-mix(in srgb, var(--mint, #18c889) 18%, transparent), transparent)",
            }}
          />
        )}

        {/* Titlebar */}
        <div className="flex h-11 items-center justify-between border-b border-border/60 bg-muted/40 px-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-rose-500/80" />
              <span className="h-3 w-3 rounded-full bg-amber-500/80" />
              <span className="h-3 w-3 rounded-full bg-emerald-500/80" />
            </div>
            <HakkiuLogo className="hidden h-3 text-foreground/80 sm:block" />
          </div>
          <div className="hidden items-center gap-2 rounded-md border border-border/60 bg-background px-3 py-1 font-mono text-[11px] text-muted-foreground md:flex">
            <Lock className="h-3 w-3 text-emerald-500" />
            app.hakkiu.com/live-monitoring
          </div>
          <div className="flex items-center gap-2">
            {/* "Example" makes clear this is an illustrative mock, not live
                customer data (the listing/hash values below are synthetic). */}
            <span className="rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Example
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
              <span className="hakkiu-pulse-soft h-1.5 w-1.5 rounded-full bg-emerald-500" />
              ACTIVE
            </span>
          </div>
        </div>

        {/* Content: detections + evidence dossier */}
        <div className="grid grid-cols-1 divide-y divide-border/60 lg:grid-cols-12 lg:divide-x lg:divide-y-0">
          {/* Detections feed */}
          <div className="relative space-y-3 overflow-hidden p-5 lg:col-span-7">
            {/* faint sweep drifting down the feed — reinforces "always watching" */}
            <div
              className="hakkiu-sweep pointer-events-none absolute inset-x-0 top-0 z-10 h-14"
              style={{
                background:
                  "linear-gradient(to bottom, transparent, color-mix(in srgb, var(--mint, #18c889) 12%, transparent), transparent)",
              }}
            />
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <span className="flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <Search className="h-3.5 w-3.5" />
                Real-time detections
              </span>
              <span className="font-mono text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                3 flagged
              </span>
            </div>

            {DETECTIONS.map((d, i) => {
              const tone = TONES[d.tone];
              const Icon = d.icon;
              return (
                <div
                  key={d.channel}
                  className={cn(
                    "hakkiu-row-in relative flex items-start justify-between rounded-lg border p-3 text-xs",
                    tone.card,
                  )}
                  style={{ animationDelay: `${0.5 + i * 0.18}s` }}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
                        tone.icon,
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <div>
                      <div className="flex flex-wrap items-center gap-2 font-medium text-foreground">
                        <span>{d.channel}</span>
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.5 text-[10px] font-semibold",
                            tone.chip,
                            d.tone === "rose" && "hakkiu-pulse-soft",
                          )}
                        >
                          {d.badge}
                        </span>
                      </div>
                      <p className="mt-1 font-mono text-[11px] text-muted-foreground">{d.meta}</p>
                    </div>
                  </div>
                  <span className="ml-2 shrink-0 font-mono text-[10px] text-muted-foreground">
                    {d.time}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Evidence dossier */}
          <div className="space-y-4 bg-muted/10 p-5 lg:col-span-5">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Dossier #TRC-8942
              </span>
              <span className="rounded-full bg-foreground px-2 py-0.5 text-[10px] font-semibold text-background">
                Ready to enforce
              </span>
            </div>

            <div className="space-y-2 text-xs">
              {DOSSIER.map((row) => (
                <div
                  key={row.label}
                  className="flex justify-between gap-3 rounded bg-muted/40 p-2 font-mono"
                >
                  <span className="text-muted-foreground">{row.label}</span>
                  <span
                    className={cn(
                      "truncate font-semibold",
                      row.mint ? "text-emerald-600 dark:text-emerald-400" : "text-foreground",
                    )}
                  >
                    {row.value}
                    {row.label === "Evidence hash" && (
                      <span className="hakkiu-blink ml-0.5 text-emerald-500">▋</span>
                    )}
                  </span>
                </div>
              ))}
            </div>

            <div className="space-y-2 rounded-lg border border-border/60 bg-background p-3.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground">Automated enforcement</span>
                <span className="font-mono text-[11px] text-emerald-600 dark:text-emerald-400">
                  1-click
                </span>
              </div>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Generates a formal trademark takedown for the marketplace's reporting channel, with
                hash-verified evidence attached.
              </p>
              <span className="relative flex h-8 w-full items-center justify-center gap-1.5 overflow-hidden rounded-md bg-foreground text-xs font-semibold text-background">
                <span className="hakkiu-sheen pointer-events-none absolute inset-0" />
                <FileText className="relative h-3.5 w-3.5" />
                <span className="relative">Submit takedown</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
