import { useEffect, useRef, useState } from "react";
import {
  Megaphone,
  ShoppingCart,
  Search,
  Globe,
  Info,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ACCENT = "oklch(0.58 0.18 255)";

// Ad-spend slider bounds. The rail is logarithmic so the €2k→€150k range stays
// legible: each visual third roughly multiplies the spend rather than adding to
// it. Positions run 0–POS_MAX for sub-euro precision on the drag.
const MIN_SPEND = 2000;
const MAX_SPEND = 150000;
const POS_MAX = 1000;
const LOG_SPAN = Math.log(MAX_SPEND / MIN_SPEND);

/** Slider position (0–POS_MAX) → euros on the log rail. */
function posToSpend(pos: number): number {
  return MIN_SPEND * Math.exp((pos / POS_MAX) * LOG_SPAN);
}

/** Euros → slider position, for placing the fixed tick labels on the rail. */
function spendToPct(spend: number): number {
  return (Math.log(spend / MIN_SPEND) / LOG_SPAN) * 100;
}

// Snap the raw log value to a tidy figure so the pill never reads "€24.98k".
function roundSpend(v: number): number {
  if (v >= 100000) return Math.round(v / 10000) * 10000;
  if (v >= 50000) return Math.round(v / 5000) * 5000;
  if (v >= 10000) return Math.round(v / 1000) * 1000;
  if (v >= 5000) return Math.round(v / 500) * 500;
  return Math.round(v / 250) * 250;
}

/** €6,800 → "€6.8k", €25,000 → "€25k", ≥€150k → "€150k+". */
function formatK(value: number): string {
  if (value >= MAX_SPEND) return "€150k+";
  const k = value / 1000;
  const rounded = k >= 100 ? Math.round(k) : Math.round(k * 10) / 10;
  return `€${rounded}k`;
}

const TICKS = [
  { label: "€2k", pct: 0 },
  { label: "€10k", pct: spendToPct(10000) },
  { label: "€50k", pct: spendToPct(50000) },
  { label: "€150k+", pct: 100 },
];

type ReachId = "local" | "growing" | "recognized";

const REACH: { id: ReachId; label: string; factor: number }[] = [
  { id: "local", label: "Local", factor: 0.7 },
  { id: "growing", label: "Growing", factor: 1 },
  { id: "recognized", label: "Recognized", factor: 1.35 },
];

type ChannelId = "social" | "marketplaces" | "search" | "all";

// Each channel bends the exposure multiplier: broader surfaces leak more brand.
const CHANNELS: { id: ChannelId; label: string; icon: LucideIcon; factor: number }[] = [
  { id: "social", label: "Social ads", icon: Megaphone, factor: 0.9 },
  { id: "marketplaces", label: "Marketplaces", icon: ShoppingCart, factor: 1 },
  { id: "search", label: "Search / domains", icon: Search, factor: 1 },
  { id: "all", label: "All channels", icon: Globe, factor: 1.15 },
];

// Share of ad spend leaking into brand exposure, at Growing reach / neutral
// channel. The band is wide by design — it's an order-of-magnitude estimate.
const LOW_FRACTION = 0.272;
const HIGH_FRACTION = 0.736;

/** Fires once when the element first scrolls into view. */
function useInView<T extends HTMLElement>(threshold = 0.2) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;
    const ob = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          ob.disconnect();
        }
      },
      { threshold },
    );
    ob.observe(el);
    return () => ob.disconnect();
  }, [inView, threshold]);
  return { ref, inView };
}

const EYEBROW = "text-xs font-semibold uppercase tracking-[0.18em]";

// Shared selectable-button styling for the reach and channel pickers.
function pickerClasses(selected: boolean) {
  return cn(
    "rounded-xl border text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[oklch(0.58_0.18_255)]/40",
    selected
      ? "border-[oklch(0.58_0.18_255)] bg-[oklch(0.58_0.18_255)]/8 text-[oklch(0.58_0.18_255)]"
      : "border-border bg-card text-foreground/80 hover:border-[oklch(0.58_0.18_255)]/40 hover:text-foreground",
  );
}

export function ExposureCalculator() {
  const { ref, inView } = useInView<HTMLElement>();
  // Default: ~€25k spend, Growing reach, Search / domains channel.
  const [pos, setPos] = useState(585);
  const [reach, setReach] = useState<ReachId>("growing");
  const [channel, setChannel] = useState<ChannelId>("search");

  const spend = roundSpend(posToSpend(pos));
  const reachFactor = REACH.find((r) => r.id === reach)!.factor;
  const channelFactor = CHANNELS.find((c) => c.id === channel)!.factor;
  const multiplier = reachFactor * channelFactor;

  const low = spend * LOW_FRACTION * multiplier;
  const high = spend * HIGH_FRACTION * multiplier;
  const fillPct = (pos / POS_MAX) * 100;

  return (
    <section ref={ref} id="calculator" className="relative scroll-mt-16 py-14 md:py-16">
      <div className="mx-auto w-full max-w-[80rem] px-6 md:px-10 lg:px-12">
        <div
          className={cn(
            "overflow-hidden rounded-3xl border border-border bg-card shadow-[0_20px_60px_-32px_rgba(15,23,42,0.35)] transition-all duration-700 ease-out motion-reduce:transition-none",
            inView ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
          )}
        >
          <div className="p-6 md:p-8">
            {/* Header */}
            <div className={EYEBROW} style={{ color: ACCENT }}>
              Interactive estimate
            </div>
            <h2 className="mt-3 font-display text-2xl font-bold tracking-tight md:text-3xl">
              Brand Exposure Calculator
            </h2>
            <p className="mt-2.5 max-w-xl text-sm leading-relaxed text-muted-foreground">
              A quick estimate based on your brand visibility and main exposure channel.
            </p>

            {/* Controls — one row when they fit, wrapping to the next line
                (not shrinking) once the min-widths no longer share the row. */}
            <div className="mt-8 flex flex-wrap gap-7 md:gap-8">
              {/* Monthly ad spend */}
              <div className="min-w-[280px] flex-[1.4]">
                <div className="flex items-center justify-between gap-3">
                  <label htmlFor="ad-spend" className="text-sm font-semibold">
                    Monthly ad spend
                  </label>
                  <span className="rounded-lg border border-border bg-background px-2.5 py-1 shadow-sm">
                    <span className="text-sm font-bold" style={{ color: ACCENT }}>
                      {formatK(spend)}
                    </span>
                    <span className="text-xs font-medium text-muted-foreground"> / month</span>
                  </span>
                </div>

                <input
                  id="ad-spend"
                  type="range"
                  min={0}
                  max={POS_MAX}
                  value={pos}
                  onChange={(e) => setPos(Number(e.target.value))}
                  aria-valuetext={`${formatK(spend)} per month`}
                  className="exposure-slider mt-4"
                  style={{
                    background: `linear-gradient(to right, ${ACCENT} ${fillPct}%, var(--border) ${fillPct}%)`,
                  }}
                />

                <div className="relative mt-3 h-4 text-xs font-medium text-muted-foreground">
                  {TICKS.map((tick, i) => (
                    <span
                      key={tick.label}
                      className="absolute whitespace-nowrap"
                      style={{
                        left: `${tick.pct}%`,
                        transform:
                          i === 0
                            ? "translateX(0)"
                            : i === TICKS.length - 1
                              ? "translateX(-100%)"
                              : "translateX(-50%)",
                      }}
                    >
                      {tick.label}
                    </span>
                  ))}
                </div>
              </div>

              {/* Brand reach — a ladder from local to recognized */}
              <div className="min-w-[220px] flex-1">
                <div className="text-sm font-semibold">Brand reach</div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {REACH.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      aria-pressed={reach === option.id}
                      onClick={() => setReach(option.id)}
                      className={cn(pickerClasses(reach === option.id), "px-2 py-2")}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Main exposure channel */}
              <div className="min-w-[260px] flex-[1.2]">
                <div className="text-sm font-semibold">Main exposure channel</div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {CHANNELS.map((option) => {
                    const Icon = option.icon;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        aria-pressed={channel === option.id}
                        onClick={() => setChannel(option.id)}
                        className={cn(
                          pickerClasses(channel === option.id),
                          "flex items-center justify-center gap-2 px-2.5 py-2",
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" strokeWidth={2} />
                        <span className="truncate">{option.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Estimate band */}
          <div className="border-t border-border bg-[oklch(0.985_0.005_250)] px-6 py-6 md:px-8 md:py-7 dark:bg-[oklch(0.17_0.035_260)]">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className={EYEBROW} style={{ color: ACCENT }}>
                  Estimated exposure
                </div>
                <div className="mt-2.5 font-display text-4xl font-bold tracking-tight tabular-nums md:text-5xl">
                  {formatK(low)} <span className="text-muted-foreground/50">–</span> {formatK(high)}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Estimated monthly brand exposure
                </p>
              </div>

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Info className="h-4 w-4 shrink-0" strokeWidth={2} />
                Estimate based on common brand exposure patterns.
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
