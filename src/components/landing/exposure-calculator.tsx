import { useState } from "react";
import {
  Megaphone,
  ShoppingCart,
  Search,
  Globe,
  ArrowRight,
  UserX,
  Link2,
  Copy,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BlueprintOverlay } from "./blueprint";
import { Reveal, useInView } from "./reveal";
import { useLeadModals } from "./lead-modals";

const ACCENT = "oklch(0.58 0.18 255)";
const MINT = "#18c889";

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

// Exposure vectors surfaced on the result panel — fixed, illustrative copy.
const VECTORS = [
  {
    icon: UserX,
    title: "Paid-media impersonation",
    body: "Ads and pages hijacking your brand name.",
  },
  { icon: Link2, title: "Typosquatted domains", body: "Look-alike URLs capturing brand traffic." },
  {
    icon: Copy,
    title: "Marketplace duplication",
    body: "Counterfeit listings and unauthorized resellers.",
  },
];

// Shared selectable-button styling for the reach and channel pickers.
function pickerClasses(selected: boolean) {
  return cn(
    "rounded-lg border text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer",
    selected
      ? "border-foreground bg-foreground text-background shadow-sm"
      : "border-border/80 bg-card text-foreground/80 hover:border-foreground/40 hover:text-foreground",
  );
}

const EYEBROW = "font-mono text-[11px] font-semibold uppercase tracking-[0.2em]";

export function ExposureCalculator() {
  const { openDemo, openSales } = useLeadModals();
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
    <section
      ref={ref}
      id="calculator"
      className="technical-paper relative scroll-mt-16 border-b border-border/60 py-20 md:py-24"
    >
      <BlueprintOverlay variant="proof" />

      <div className="relative mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <Reveal as="p" className={cn(EYEBROW, "text-muted-foreground")}>
            Interactive risk estimate
          </Reveal>
          <Reveal
            as="h2"
            delay={60}
            className="mt-4 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
          >
            What could counterfeit exposure cost your brand?
          </Reveal>
          <Reveal as="p" delay={120} className="mt-4 text-base text-muted-foreground">
            Adjust three inputs for a directional monthly exposure range.
          </Reveal>
        </div>

        <div
          className={cn(
            "mt-12 grid grid-cols-1 gap-6 transition-all duration-700 ease-out motion-reduce:transition-none lg:grid-cols-[1.15fr_0.85fr]",
            inView ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
          )}
        >
          {/* Controls */}
          <div className="rounded-3xl border border-border bg-card p-6 shadow-sm md:p-8">
            {/* 1 · Monthly ad spend */}
            <div>
              <div className="flex items-center justify-between gap-3">
                <label htmlFor="ad-spend" className="text-sm font-semibold text-foreground">
                  <span className="text-muted-foreground">1.</span> Monthly ad spend
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

            {/* 2 · Brand reach */}
            <div className="mt-8">
              <div className="text-sm font-semibold text-foreground">
                <span className="text-muted-foreground">2.</span> Brand reach
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {REACH.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={reach === option.id}
                    onClick={() => setReach(option.id)}
                    className={cn(pickerClasses(reach === option.id), "px-2 py-2.5")}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 3 · Main exposure channel */}
            <div className="mt-8">
              <div className="text-sm font-semibold text-foreground">
                <span className="text-muted-foreground">3.</span> Main exposure channel
              </div>
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
                        "flex items-center justify-center gap-2 px-2.5 py-2.5",
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

          {/* Result panel — inverse forensic surface */}
          <div className="flex flex-col rounded-3xl border border-white/10 bg-[#090d13] p-6 text-slate-100 shadow-lg md:p-8">
            <div className={cn(EYEBROW, "text-slate-400")}>Estimated monthly exposure</div>
            <div className="mt-3 font-display text-4xl font-bold tracking-tight tabular-nums md:text-5xl">
              {formatK(low)} <span className="text-slate-500">–</span> {formatK(high)}
            </div>
            <div
              className="mt-3 inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider"
              style={{ borderColor: `${MINT}55`, color: MINT }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: MINT }} />
              Elevated exposure
            </div>

            <ul className="mt-6 space-y-3 border-t border-white/10 pt-6">
              {VECTORS.map((v) => {
                const Icon = v.icon;
                return (
                  <li key={v.title} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/5 text-slate-300">
                      <Icon className="h-3.5 w-3.5" strokeWidth={2} />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-slate-100">{v.title}</p>
                      <p className="text-xs text-slate-400">{v.body}</p>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="mt-7 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={openDemo}
                className="group inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-white text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-100"
              >
                Get a tailored plan
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </button>
              <button
                type="button"
                onClick={openSales}
                className="inline-flex h-11 items-center justify-center rounded-lg border border-white/20 bg-white/5 text-sm font-semibold text-white transition-colors hover:border-white/40 hover:bg-white/10"
              >
                Talk to sales
              </button>
            </div>

            <p className="mt-4 text-center text-[11px] text-slate-500">
              Directional estimate — a share of your monthly ad spend, scaled by brand reach and
              channel mix. Illustrative, not a measurement of actual losses.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
