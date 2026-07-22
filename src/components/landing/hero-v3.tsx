import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { TalkToSalesModal } from "./talk-to-sales-modal";
import {
  Radio,
  ArrowRight,
  CalendarCheck,
  Headphones,
  Award,
  ShoppingBag,
  Globe,
  ShieldCheck,
  BadgeCheck,
  AlertTriangle,
  ScanEye,
  Sparkle,
  BarChart3,
  Camera,
  Link2,
  UserRound,
  Clock,
  DollarSign,
  Check,
  FolderCheck,
  Send,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Brand tokens (mirror styles.css so the visual reads on-brand).
const BLUE = "oklch(0.55 0.19 262)";
const RED = "oklch(0.58 0.22 27)";

// The right-side visual is one continuous composition. HAKKIU itself — the
// dashed monitoring boundary — is the through-line: it morphs and relabels as
// the story advances, so the platform reads as the active system.
//   0 monitor → 1 detect → 2 investigate → 3 takedown ready
const PHASE_COUNT = 4;

const stats = [
  { value: "24/7", label: "Always on" },
  { value: "12", label: "Markets watched" },
  { value: "99.8%", label: "Uptime" },
];

export function HeroV3() {
  const [salesOpen, setSalesOpen] = useState(false);

  return (
    <>
    <TalkToSalesModal open={salesOpen} onOpenChange={setSalesOpen} />
    <section className="relative flex min-h-screen flex-col overflow-hidden border-b border-border bg-[radial-gradient(130%_120%_at_78%_18%,oklch(0.97_0.02_255)_0%,oklch(0.985_0.005_250)_46%,oklch(0.98_0.004_250)_100%)] dark:bg-[radial-gradient(130%_120%_at_78%_18%,oklch(0.18_0.04_260)_0%,oklch(0.14_0.03_260)_46%,oklch(0.12_0.03_260)_100%)] text-foreground">
      {/* faint grid detail */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.5] [background-image:linear-gradient(oklch(0.7_0.03_255/0.12)_1px,transparent_1px),linear-gradient(90deg,oklch(0.7_0.03_255/0.12)_1px,transparent_1px)] [background-size:44px_44px] [mask-image:radial-gradient(120%_100%_at_75%_20%,black_0%,transparent_72%)]"
      />

      <div className="relative mx-auto grid w-full max-w-[1560px] flex-1 items-start gap-12 px-6 pb-10 pt-20 md:px-12 lg:grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)] lg:gap-16 lg:pb-8 lg:pl-16 lg:pr-8 lg:pt-24 xl:pl-24 xl:pr-12">
        {/* ── LEFT: marketing content ─────────────────────────────── */}
        <div className="flex flex-col justify-center">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[oklch(0.58_0.18_255/0.25)] dark:border-white/10 bg-white/70 dark:bg-slate-900/70 px-3.5 py-1.5 text-sm font-medium text-[oklch(0.5_0.16_255)] dark:text-blue-400 shadow-sm shadow-[oklch(0.58_0.18_255/0.08)] dark:shadow-none backdrop-blur">
            <Radio className="h-4 w-4" strokeWidth={2.25} />
            Always-on brand monitoring
          </div>

          <h1 className="mt-7 font-display text-5xl font-bold leading-[1.03] tracking-tight text-[oklch(0.22_0.05_262)] dark:text-slate-100 md:text-6xl lg:text-[3.9rem]">
            Detect infringements before they spread
            <span className="text-[oklch(0.58_0.18_255)]">.</span>
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-relaxed text-[oklch(0.5_0.03_257)] dark:text-slate-400">
            HAKKIU monitors marketplaces, social channels, domains, and listings to turn
            suspicious activity into evidence-ready takedown cases.
          </p>

          <div className="mt-9 flex flex-wrap gap-3">
            <Button
              asChild
              size="lg"
              className="h-12 gap-2 rounded-xl bg-[oklch(0.55_0.19_262)] px-6 text-base shadow-lg shadow-[oklch(0.55_0.19_262/0.28)] hover:bg-[oklch(0.5_0.19_262)]"
            >
              <Link to="/plans">
                Start monitoring
                <ArrowRight className="h-4.5 w-4.5" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-12 gap-2 rounded-xl border-[oklch(0.58_0.18_255/0.35)] dark:border-white/20 bg-white/60 dark:bg-slate-900/60 px-6 text-base text-[oklch(0.45_0.16_262)] dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 hover:text-[oklch(0.4_0.17_262)] dark:hover:text-white"
            >
              <Link to="/request-demo">
                <CalendarCheck className="h-4.5 w-4.5" />
                Book a demo
              </Link>
            </Button>
          </div>

          <p className="mt-4 text-sm text-[oklch(0.55_0.03_257)] dark:text-slate-400">
            Need to talk first?{" "}
            <button
              onClick={() => setSalesOpen(true)}
              className="font-medium text-[oklch(0.5_0.16_262)] dark:text-blue-400 underline underline-offset-2 hover:no-underline"
            >
              Talk to sales →
            </button>
          </p>
        </div>

        {/* ── RIGHT: animated product-storytelling visual ─────────── */}
        <div className="hidden lg:block">
          <ProductStory />
        </div>
      </div>

      {/* ── stats strip (carried over from Hero V2) ─────────────── */}
      <div className="relative mx-auto w-full max-w-[1560px] px-6 pb-12 md:px-12 lg:pb-14 lg:pl-16 lg:pr-8 xl:pl-24 xl:pr-12">
        <dl className="flex flex-wrap items-baseline gap-x-10 gap-y-3 border-t border-border pt-6 md:gap-x-14">
          {stats.map((s) => (
            <div key={s.label} className="flex items-baseline gap-2">
              <dt className="sr-only">{s.label}</dt>
              <dd className="font-display text-xl font-semibold tracking-tight text-[oklch(0.22_0.05_262)] dark:text-slate-100">
                {s.value}
              </dd>
              <span className="text-[11px] uppercase tracking-[0.14em] text-[oklch(0.5_0.03_257)] dark:text-slate-400">
                {s.label}
              </span>
            </div>
          ))}
        </dl>
      </div>

    </section>
    </>
  );
}

/* ════════════════════════════════════════════════════════════════════
   The looping stage
   ════════════════════════════════════════════════════════════════════ */

// Two boundary footprints: the tight monitoring layer, and the expanded
// investigation zone. Values are CSS insets (% of the stage).
const BOX_MONITOR = { left: "15%", top: "7%", right: "3%", bottom: "12%" };
const BOX_INVESTIGATE = { left: "4%", top: "6%", right: "1%", bottom: "4%" };

function ProductStory() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setPhase((p) => (p + 1) % PHASE_COUNT), 5200);
    return () => clearInterval(t);
  }, []);

  const investigating = phase === 2;
  const box = investigating ? BOX_INVESTIGATE : BOX_MONITOR;
  const boundaryLabel = investigating
    ? "HAKKIU Investigation Zone"
    : "HAKKIU Monitoring Layer";

  return (
    <div className="relative mx-auto aspect-[14/13] w-full max-w-[760px]">
      {/* radar rings — the pulse HAKKIU emits while watching */}
      <RadarField phase={phase} />

      {/* ── the signature: HAKKIU's morphing boundary ── */}
      <div
        className={cn(
          "absolute rounded-[32px] border border-dashed transition-all duration-700 ease-out",
          investigating
            ? "border-[oklch(0.55_0.16_262/0.55)] bg-[oklch(0.6_0.12_262/0.03)]"
            : "border-[oklch(0.6_0.12_262/0.4)]",
        )}
        style={box}
      >
        <div className="absolute -top-3.5 left-1/2 flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full border border-[oklch(0.6_0.12_262/0.3)] bg-white px-3 py-1.5 shadow-sm">
          <ShieldCheck className="h-4 w-4 text-[oklch(0.55_0.19_262)]" strokeWidth={2.5} />
          <span className="text-sm font-semibold text-[oklch(0.42_0.14_262)]">{boundaryLabel}</span>
        </div>
      </div>

      {/* ── phase frames (crossfade) ── */}
      <Frame active={phase === 0 || phase === 1}>
        <MonitorScene detecting={phase === 1} />
      </Frame>

      <Frame active={phase === 2}>
        <InvestigateScene />
      </Frame>

      <Frame active={phase === 3}>
        <TakedownScene />
      </Frame>

      {/* progress stepper */}
      <div className="absolute -bottom-1 left-1/2 flex -translate-x-1/2 items-center gap-2">
        {Array.from({ length: PHASE_COUNT }).map((_, i) => (
          <span
            key={i}
            className={cn(
              "h-1.5 rounded-full transition-all duration-500",
              i === phase ? "w-6 bg-[oklch(0.55_0.19_262)]" : "w-1.5 bg-[oklch(0.7_0.03_255/0.4)]",
            )}
          />
        ))}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────
   Scenes
   ──────────────────────────────────────────────────────────────────── */

// Phase 0 (monitor) + phase 1 (detect share the same base layout).
function MonitorScene({ detecting }: { detecting: boolean }) {
  return (
    <>
      {/* connector lines feed the channels INTO the boundary, via the product */}
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <Line d="M56 46 H37 V32" />
        <Line d="M56 46 H74 V32" />
        <Line d="M56 46 V70 H50" />
        {detecting && <Line d="M86 71 V80" color={RED} dashed animated opacity={0.8} />}
      </svg>
      <Node x={37} y={32} />
      <Node x={74} y={32} />
      <Node x={50} y={70} />
      {detecting && <Node x={86} y={71} color={RED} />}

      <Positioned x={31} y={27}>
        <BrandRegistrationCard />
      </Positioned>
      <Positioned x={81} y={27}>
        <MarketplaceCard />
      </Positioned>
      <Positioned x={48} y={78}>
        <WebsiteCard />
      </Positioned>

      {/* central protected product, inside the monitoring layer */}
      <Positioned x={56} y={44}>
        <ProductCard />
      </Positioned>

      {/* the suspicious listing enters from outside the boundary */}
      {detecting && (
        <Positioned x={86} y={82}>
          <UnauthorizedCard />
        </Positioned>
      )}
    </>
  );
}

const EVIDENCE = [
  { icon: Camera, label: "Screenshot captured" },
  { icon: Link2, label: "URL saved" },
  { icon: UserRound, label: "Seller snapshot" },
  { icon: Clock, label: "Timestamp verified" },
  { icon: DollarSign, label: "Price comparison" },
];

// Fixed vertical centres for the evidence chips (stage %), so the connector
// lines can be drawn to match them exactly.
const CHIP_YS = [22, 36, 50, 64, 78];

function InvestigateScene() {
  return (
    <>
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {/* each chip's line converges into the pack's left edge */}
        {CHIP_YS.map((y) => (
          <Line key={y} d={`M30 ${y} C 37 ${y}, 39 48, 43 48`} dashed animated opacity={0.6} />
        ))}
        {/* the flagged source feeds the same case */}
        <Line d="M75 68 C 74 61, 73 57, 72 53" color={RED} dashed animated opacity={0.8} />
      </svg>

      {/* the original product, kept as a small muted reference */}
      <Positioned x={86} y={20}>
        <div className="opacity-50 saturate-50">
          <ProductCard reference protectedPill={false} />
        </div>
      </Positioned>

      {/* evidence capture chips — anchored to CHIP_YS */}
      {EVIDENCE.map((e, i) => (
        <Positioned key={e.label} x={19} y={CHIP_YS[i]}>
          <div
            className="flex w-40 items-center gap-2 rounded-xl border border-[oklch(0.9_0.01_255)] bg-white px-2.5 py-2 shadow-sm duration-500 animate-in fade-in-0 slide-in-from-left-3"
            style={{ animationDelay: `${i * 90}ms` }}
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[oklch(0.95_0.03_262)] text-[oklch(0.5_0.16_262)]">
              <e.icon className="h-3.5 w-3.5" strokeWidth={2} />
            </span>
            <span className="text-xs font-medium leading-tight text-[oklch(0.3_0.04_262)] dark:text-slate-200">
              {e.label}
            </span>
          </div>
        </Positioned>
      ))}

      {/* evidence pack — the case takes shape */}
      <Positioned x={58} y={48}>
        <EvidencePackCard />
      </Positioned>

      {/* the marketplace listing, now flagged as the source */}
      <Positioned x={86} y={74}>
        <SourceCard />
      </Positioned>
    </>
  );
}

function TakedownScene() {
  return (
    <>
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <Line d="M56 46 H37 V30" opacity={0.3} />
        <Line d="M56 46 H74 V30" opacity={0.3} />
        <Line d="M56 46 V72 H84" opacity={0.3} />
      </svg>

      {/* muted footprint */}
      <Positioned x={31} y={26}>
        <div className="opacity-40 saturate-50">
          <BrandRegistrationCard compact />
        </div>
      </Positioned>
      <Positioned x={82} y={26}>
        <div className="opacity-40 saturate-50">
          <MarketplaceCard />
        </div>
      </Positioned>
      <Positioned x={30} y={80}>
        <div className="opacity-40 saturate-50">
          <WebsiteCard />
        </div>
      </Positioned>

      {/* the protected product, restored */}
      <Positioned x={85} y={78}>
        <ProductCard protectedPill />
      </Positioned>

      {/* dominant result */}
      <Positioned x={55} y={45}>
        <TakedownCard />
      </Positioned>
    </>
  );
}

/* ────────────────────────────────────────────────────────────────────
   Primitives
   ──────────────────────────────────────────────────────────────────── */

function Frame({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "absolute inset-0 transition-opacity duration-700",
        active ? "opacity-100" : "pointer-events-none opacity-0",
      )}
    >
      {children}
    </div>
  );
}

function Positioned({ x, y, children }: { x: number; y: number; children: React.ReactNode }) {
  return (
    <div
      className="absolute -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${x}%`, top: `${y}%` }}
    >
      {children}
    </div>
  );
}

function Line({
  d,
  color = BLUE,
  dashed,
  animated,
  opacity = 0.5,
}: {
  d: string;
  color?: string;
  dashed?: boolean;
  animated?: boolean;
  opacity?: number;
}) {
  return (
    <path
      d={d}
      fill="none"
      stroke={color}
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      vectorEffect="non-scaling-stroke"
      strokeDasharray={dashed ? "3 3" : undefined}
      opacity={opacity}
      className={animated ? "motion-safe:[animation:dashmove_0.6s_linear_infinite]" : undefined}
    />
  );
}

function Node({ x, y, color = BLUE }: { x: number; y: number; color?: string }) {
  return (
    <span
      className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-sm"
      style={{ left: `${x}%`, top: `${y}%`, backgroundColor: color }}
    />
  );
}

function RadarField({ phase }: { phase: number }) {
  // Rings emanate from the product's spot in the monitoring layer.
  const visible = phase === 0 || phase === 1 || phase === 3;
  const alert = phase === 1;
  return (
    <div
      className={cn(
        "pointer-events-none absolute transition-opacity duration-700",
        visible ? "opacity-100" : "opacity-0",
      )}
      style={{ left: "56%", top: "44%" }}
    >
      <div className="absolute -translate-x-1/2 -translate-y-1/2">
        {[0.32, 0.54, 0.78, 1].map((s, i) => (
          <span
            key={i}
            className={cn(
              "absolute aspect-square -translate-x-1/2 -translate-y-1/2 rounded-full border transition-colors duration-700",
              alert ? "border-[oklch(0.58_0.22_27/0.22)]" : "border-[oklch(0.55_0.16_262/0.16)]",
            )}
            style={{ width: `${s * 460}px` }}
          />
        ))}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────
   Cards
   ──────────────────────────────────────────────────────────────────── */

const cardBase =
  "rounded-2xl border border-[oklch(0.9_0.01_255)] dark:border-white/10 bg-white dark:bg-slate-900 shadow-[0_18px_40px_-24px_oklch(0.4_0.1_262/0.45)] dark:shadow-none";

function ProductCard({
  reference,
  protectedPill = true,
}: {
  reference?: boolean;
  protectedPill?: boolean;
}) {
  return (
    <div className={cn(cardBase, reference ? "w-40 p-3" : "w-48 p-3.5")}>
      <div
        className={cn(
          "flex w-full items-center justify-center rounded-xl bg-[oklch(0.96_0.006_255)] dark:bg-slate-950",
          reference ? "h-14" : "h-20",
        )}
      >
        <div
          className="relative flex items-center justify-center rounded-xl bg-gradient-to-br from-[oklch(0.28_0.04_262)] to-[oklch(0.18_0.04_262)] text-white shadow-md"
          style={{
            height: reference ? "2.5rem" : "3.25rem",
            width: reference ? "2.5rem" : "3.25rem",
          }}
        >
          <Headphones className={reference ? "h-5 w-5" : "h-6.5 w-6.5"} strokeWidth={1.5} />
          <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-white dark:bg-slate-800 text-[0.55rem] font-bold text-[oklch(0.3_0.05_262)] dark:text-slate-200 shadow">
            M
          </span>
        </div>
      </div>
      <div
        className={cn(
          "mt-2.5 font-semibold text-[oklch(0.22_0.05_262)] dark:text-slate-100",
          reference ? "text-sm" : "text-base",
        )}
      >
        Marka Headphones
      </div>
      <div className="mt-1 flex items-center gap-1.5">
        <ShieldCheck className="h-3.5 w-3.5 text-[oklch(0.3_0.05_262)] dark:text-slate-400" strokeWidth={2.25} />
        <span className="text-xs font-medium text-[oklch(0.35_0.04_262)] dark:text-slate-300">Marka</span>
        <BadgeCheck className="h-3.5 w-3.5 text-[oklch(0.58_0.18_255)]" strokeWidth={2.25} />
      </div>
      {protectedPill && (
        <span className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-[oklch(0.95_0.05_155)] dark:bg-emerald-950/40 px-2.5 py-1 text-xs font-semibold text-[oklch(0.45_0.12_155)] dark:text-emerald-400">
          <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2.25} />
          Protected
        </span>
      )}
    </div>
  );
}

function BrandRegistrationCard({ compact }: { compact?: boolean }) {
  return (
    <div className={cn(cardBase, compact ? "w-48 p-4" : "w-52 p-4")}>
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[oklch(0.95_0.03_262)] dark:bg-indigo-950/40 text-[oklch(0.55_0.18_262)] dark:text-indigo-400 dark:text-indigo-400">
        <Award className="h-5.5 w-5.5" strokeWidth={2} />
      </div>
      <div className="mt-3 text-[0.95rem] font-semibold text-[oklch(0.25_0.05_262)] dark:text-slate-100">
        Brand Registration
      </div>
      <div className="mt-1 text-sm leading-snug text-[oklch(0.55_0.03_257)] dark:text-slate-400">
        USPTO
        <br />
        Reg. No. 5,123,456
      </div>
      <div className="mt-3 flex items-center gap-1.5 text-sm font-medium text-[oklch(0.5_0.13_155)] dark:text-emerald-400">
        <span className="h-2 w-2 rounded-full bg-[oklch(0.62_0.15_155)]" />
        Active
      </div>
    </div>
  );
}

function MarketplaceCard() {
  return (
    <div className={cn(cardBase, "w-52 p-4")}>
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[oklch(0.95_0.03_255)] dark:bg-blue-950/40 text-[oklch(0.5_0.16_255)] dark:text-blue-400">
          <ShoppingBag className="h-4 w-4" strokeWidth={2} />
        </span>
        <span className="text-sm font-semibold text-[oklch(0.25_0.05_262)] dark:text-slate-100 dark:text-slate-100">Amazon</span>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[oklch(0.96_0.006_255)] dark:bg-slate-950 text-[oklch(0.4_0.03_262)] dark:text-slate-300">
          <Headphones className="h-6 w-6" strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <span className="block h-2 w-full rounded-full bg-[oklch(0.92_0.01_255)] dark:bg-slate-800" />
          <span className="block h-2 w-3/5 rounded-full bg-[oklch(0.94_0.008_255)] dark:bg-slate-850" />
          <span className="text-sm font-semibold text-[oklch(0.3_0.04_262)] dark:text-slate-200">$59.99</span>
        </div>
      </div>
      <span className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[oklch(0.95_0.03_255)] dark:bg-blue-950/40 px-2.5 py-1 text-sm font-medium text-[oklch(0.5_0.16_255)] dark:text-blue-400">
        <ShoppingBag className="h-3.5 w-3.5" strokeWidth={2} />
        Marketplace
      </span>
    </div>
  );
}

function WebsiteCard() {
  return (
    <div className={cn(cardBase, "w-52 p-4")}>
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[oklch(0.95_0.04_180)] dark:bg-teal-950/40 text-[oklch(0.5_0.13_180)] dark:text-teal-400">
        <Globe className="h-5.5 w-5.5" strokeWidth={2} />
      </div>
      <div className="mt-3 text-[0.95rem] font-semibold text-[oklch(0.25_0.05_262)] dark:text-slate-100">
        cheapheadphones.co
      </div>
      <span className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[oklch(0.95_0.04_180)] dark:bg-teal-950/40 px-2.5 py-1 text-sm font-medium text-[oklch(0.45_0.11_180)] dark:text-teal-400">
        <Globe className="h-3.5 w-3.5" strokeWidth={2} />
        Website / Domain
      </span>
    </div>
  );
}

// The suspicious listing — appears outside the boundary, then gets flagged.
function UnauthorizedCard() {
  return (
    <div className="relative w-56 rounded-2xl border border-[oklch(0.58_0.22_27/0.5)] dark:border-red-950/50 bg-white dark:bg-slate-900 p-4 shadow-[0_0_0_4px_oklch(0.58_0.22_27/0.08),0_18px_40px_-22px_oklch(0.58_0.22_27/0.5)] dark:shadow-none duration-500 animate-in fade-in-0 slide-in-from-bottom-3">
      {/* target rings — HAKKIU locks on */}
      <span className="absolute -left-3 -top-3 flex h-9 w-9 items-center justify-center">
        <span className="absolute h-full w-full rounded-full border-2 border-[oklch(0.58_0.22_27/0.5)] motion-safe:animate-ping" />
        <span className="h-4 w-4 rounded-full bg-[oklch(0.58_0.22_27)] ring-4 ring-[oklch(0.58_0.22_27/0.2)]" />
      </span>

      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[oklch(0.96_0.006_255)] dark:bg-slate-950 text-[oklch(0.4_0.03_262)] dark:text-slate-300">
            <Headphones className="h-5.5 w-5.5" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-[oklch(0.25_0.05_262)] dark:text-slate-100 dark:text-slate-100">
              Marka Headphones
            </div>
            <div className="text-xs text-[oklch(0.55_0.03_257)] dark:text-slate-400">Unknown Seller</div>
            <div className="text-sm font-bold text-[oklch(0.55_0.2_27)] dark:text-red-400">$29.99</div>
          </div>
        </div>
        <span className="rounded-md bg-[oklch(0.58_0.22_27)] px-1.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-white">
          New
        </span>
      </div>

      <div className="mt-3 space-y-1.5">
        <RiskChip icon={ShieldCheck} label="Detected" />
        <RiskChip icon={Sparkle} label="AI flagged" />
        <RiskChip icon={BarChart3} label="Risk score: High" />
      </div>
    </div>
  );
}

function RiskChip({ icon: Icon, label }: { icon: typeof ShieldCheck; label: string }) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg bg-[oklch(0.96_0.04_27)] dark:bg-red-950/40 px-2.5 py-1 text-sm font-medium text-[oklch(0.55_0.2_27)] dark:text-red-400">
      <Icon className="h-4 w-4" strokeWidth={2.25} />
      {label}
    </div>
  );
}

// The marketplace listing, reframed as the source once investigated.
function SourceCard() {
  return (
    <div className="w-52 rounded-2xl border border-[oklch(0.58_0.22_27/0.45)] dark:border-red-950/50 bg-[oklch(0.99_0.01_27)] dark:bg-slate-900 p-4 shadow-[0_18px_40px_-24px_oklch(0.58_0.22_27/0.4)] dark:shadow-none">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[oklch(0.96_0.04_27)] dark:bg-red-950/40 text-[oklch(0.55_0.2_27)] dark:text-red-400">
          <ShoppingBag className="h-4 w-4" strokeWidth={2} />
        </span>
        <span className="text-sm font-semibold text-[oklch(0.4_0.06_27)] dark:text-slate-100">Amazon</span>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[oklch(0.96_0.02_27)] dark:bg-red-950/40 text-[oklch(0.5_0.12_27)] dark:text-red-300">
          <Headphones className="h-5.5 w-5.5" strokeWidth={1.75} />
        </div>
        <div className="text-sm font-bold text-[oklch(0.55_0.2_27)] dark:text-red-400">$29.99</div>
      </div>
      <div className="mt-3 rounded-lg bg-[oklch(0.96_0.04_27)] px-2.5 py-1.5">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-[oklch(0.5_0.2_27)] dark:text-red-400">
          <AlertTriangle className="h-4 w-4" strokeWidth={2.25} />
          Source of infringement
        </div>
        <div className="mt-0.5 pl-5.5 text-xs text-[oklch(0.55_0.12_27)] dark:text-red-300">Under investigation</div>
      </div>
    </div>
  );
}

const EVIDENCE_CHECKLIST = [
  "Screenshot",
  "URL",
  "Seller snapshot",
  "Timestamp",
  "Price comparison",
];

function EvidencePackCard() {
  return (
    <div className="w-60 rounded-3xl border border-[oklch(0.6_0.12_300/0.3)] dark:border-white/10 bg-white dark:bg-slate-900 p-5 shadow-[0_28px_60px_-28px_oklch(0.4_0.1_262/0.5)] dark:shadow-none">
      <div className="flex items-center justify-between">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[oklch(0.95_0.04_300)] dark:bg-purple-950/40 text-[oklch(0.5_0.16_300)] dark:text-purple-400">
          <FolderCheck className="h-5.5 w-5.5" strokeWidth={2} />
        </div>
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[oklch(0.55_0.19_262)] text-xs font-bold text-white">
          5
        </span>
      </div>
      <div className="mt-3 text-lg font-semibold text-[oklch(0.22_0.05_262)] dark:text-slate-100">Evidence pack</div>
      <div className="text-sm text-[oklch(0.55_0.03_257)] dark:text-slate-400">5 captures</div>
      <ul className="mt-3 space-y-1.5">
        {EVIDENCE_CHECKLIST.map((item, i) => (
          <li
            key={item}
            className="flex items-center gap-2 text-sm text-[oklch(0.35_0.03_262)] dark:text-slate-350 duration-500 animate-in fade-in-0 slide-in-from-left-2"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <Check className="h-4 w-4 text-[oklch(0.55_0.13_155)]" strokeWidth={2.75} />
            {item}
          </li>
        ))}
      </ul>
      <span className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[oklch(0.95_0.04_300)] px-3 py-1.5 text-sm font-semibold text-[oklch(0.5_0.16_300)]">
        <FolderCheck className="h-4 w-4" strokeWidth={2.25} />
        Case ready
      </span>
    </div>
  );
}

const TAKEDOWN_ROWS = [
  { icon: ScanEye, label: "Violation", value: "Trademark / Counterfeit" },
  { icon: ShoppingBag, label: "Platform", value: "Marketplace" },
  { icon: FolderCheck, label: "Evidence", value: "Complete" },
];

function TakedownCard() {
  return (
    <div className="w-72 rounded-3xl border border-[oklch(0.62_0.15_155/0.4)] dark:border-white/10 bg-white dark:bg-slate-900 p-6 shadow-[0_0_0_4px_oklch(0.62_0.15_155/0.08),0_32px_70px_-30px_oklch(0.4_0.1_262/0.55)] dark:shadow-none duration-500 animate-in fade-in-0 zoom-in-95">
      <div className="flex justify-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[oklch(0.95_0.05_155)] text-[oklch(0.55_0.14_155)]">
          <Check className="h-7 w-7" strokeWidth={3} />
        </span>
      </div>
      <div className="mt-3 text-center text-xl font-semibold text-[oklch(0.45_0.13_155)] dark:text-emerald-400">
        Takedown ready
      </div>
      <dl className="mt-4 space-y-2.5">
        {TAKEDOWN_ROWS.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-2">
            <dt className="flex items-center gap-1.5 text-sm text-[oklch(0.5_0.03_257)] dark:text-slate-400">
              <r.icon className="h-4 w-4" strokeWidth={2} />
              {r.label}
            </dt>
            <dd className="text-sm font-medium text-[oklch(0.28_0.04_262)] dark:text-slate-200">{r.value}</dd>
          </div>
        ))}
        <div className="flex items-center justify-between gap-2">
          <dt className="flex items-center gap-1.5 text-sm text-[oklch(0.5_0.03_257)] dark:text-slate-400">
            <Clock className="h-4 w-4" strokeWidth={2} />
            Status
          </dt>
          <dd className="flex items-center gap-1.5 text-sm font-medium text-[oklch(0.45_0.12_155)] dark:text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-[oklch(0.62_0.15_155)]" />
            Ready to submit
          </dd>
        </div>
      </dl>
      <button
        type="button"
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[oklch(0.55_0.14_155)] py-3 text-sm font-semibold text-white shadow-lg shadow-[oklch(0.55_0.14_155/0.3)] transition-colors hover:bg-[oklch(0.5_0.14_155)]"
      >
        <Send className="h-4 w-4" strokeWidth={2.25} />
        Prepare notice
      </button>
    </div>
  );
}
