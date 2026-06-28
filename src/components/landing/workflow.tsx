import { useCallback, useEffect, useRef, useState, Fragment } from "react";
import {
  UploadCloud,
  Globe2,
  Target,
  FileText,
  Send,
  ShoppingCart,
  ShoppingBag,
  Tag,
  Instagram,
  Store,
  Package,
  Music2,
  CheckCircle2,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ACCENT = "oklch(0.58 0.18 255)";
// Success green for the connected, GitHub-Actions style flow.
const GREEN = "oklch(0.62 0.15 155)";

interface Step {
  icon: LucideIcon;
  title: string;
  body: string;
}

const STEPS: Step[] = [
  { icon: UploadCloud, title: "Add brand assets", body: "Upload trademarks, logos, and keywords." },
  { icon: Globe2, title: "Monitoring started", body: "We scan 12+ global marketplaces 24/7." },
  { icon: Target, title: "Infringement detected", body: "AI flags potential matches in real time." },
  {
    icon: FileText,
    title: "Evidence captured / report prepared",
    body: "Screenshots, links, and details compiled.",
  },
  {
    icon: Send,
    title: "Submission and resolution",
    body: "Reports submitted to platforms for takedown.",
  },
];

type StatusTone = "pending" | "success";

interface StatusStep {
  label: string;
  tone: StatusTone;
  ms: number; // how long this state is shown before advancing (terminal = linger)
}

interface PlatformDef {
  name: string;
  icon: LucideIcon;
  tile: string; // background classes for the logo tile
  steps: StatusStep[]; // ordered; last step is the terminal (success) state
}

// A pool larger than the visible slots — platforms cycle through it. Timings
// are varied per platform so the rows resolve and swap out of sync.
const POOL: PlatformDef[] = [
  {
    name: "Amazon",
    icon: ShoppingCart,
    tile: "bg-[#FF9900] text-white",
    steps: [
      { label: "Takedown submitted", tone: "pending", ms: 2200 },
      { label: "Takedown approved", tone: "pending", ms: 2600 },
      { label: "Listing resolved", tone: "success", ms: 3200 },
    ],
  },
  {
    name: "eBay",
    icon: Tag,
    tile: "bg-[#e53238] text-white",
    steps: [
      { label: "Report filed", tone: "pending", ms: 1800 },
      { label: "Under review", tone: "pending", ms: 2400 },
      { label: "Listing removed", tone: "success", ms: 3000 },
    ],
  },
  {
    name: "Shopify",
    icon: ShoppingBag,
    tile: "bg-[#5E8E3E] text-white",
    steps: [
      { label: "Takedown submitted", tone: "pending", ms: 2600 },
      { label: "Store notified", tone: "pending", ms: 2200 },
      { label: "Listing removed", tone: "success", ms: 3400 },
    ],
  },
  {
    name: "Instagram",
    icon: Instagram,
    tile: "bg-gradient-to-tr from-[#feda75] via-[#d62976] to-[#4f5bd5] text-white",
    steps: [
      { label: "Report filed", tone: "pending", ms: 2000 },
      { label: "Reviewing", tone: "pending", ms: 2800 },
      { label: "Case resolved", tone: "success", ms: 3000 },
    ],
  },
  {
    name: "Etsy",
    icon: Store,
    tile: "bg-[#F1641E] text-white",
    steps: [
      { label: "Takedown submitted", tone: "pending", ms: 2400 },
      { label: "Approved", tone: "pending", ms: 2000 },
      { label: "Listing removed", tone: "success", ms: 3200 },
    ],
  },
  {
    name: "AliExpress",
    icon: Package,
    tile: "bg-[#E62E04] text-white",
    steps: [
      { label: "Report filed", tone: "pending", ms: 3000 },
      { label: "Under review", tone: "pending", ms: 2600 },
      { label: "Seller notified", tone: "pending", ms: 2200 },
      { label: "Resolved", tone: "success", ms: 3000 },
    ],
  },
  {
    name: "TikTok Shop",
    icon: Music2,
    tile: "bg-black text-white",
    steps: [
      { label: "Takedown submitted", tone: "pending", ms: 1800 },
      { label: "Reviewing", tone: "pending", ms: 2600 },
      { label: "Removed", tone: "success", ms: 2800 },
    ],
  },
  {
    name: "Walmart",
    icon: ShoppingCart,
    tile: "bg-[#0071CE] text-white",
    steps: [
      { label: "Report filed", tone: "pending", ms: 2200 },
      { label: "Approved", tone: "pending", ms: 2400 },
      { label: "Resolved", tone: "success", ms: 3000 },
    ],
  },
];

const SLOT_COUNT = 4;

// Deterministic geometry shared by the platform panel and the branch SVG so the
// green arrows land exactly on each row. Rows are h-11 (44px) with space-y-2.
const ROW_H = 44;
const ROW_GAP = 8;
const ROW_COUNT = SLOT_COUNT + 1; // platform slots + the "99+ more" accent row
const PANEL_HEIGHT = ROW_COUNT * ROW_H + (ROW_COUNT - 1) * ROW_GAP;
const ROW_CENTERS = Array.from({ length: ROW_COUNT }, (_, i) => ROW_H / 2 + i * (ROW_H + ROW_GAP));
const ICON_CENTER = 32; // vertical center of the h-16 step icon card
const FAN_WIDTH = 64; // matches the w-16 branch column

// Delay before the live platform feed starts — lets the steps + branch animate
// in first. The feed reveal is one-shot; subsequent card swaps are not delayed.
const FEED_REVEAL_DELAY = 900;

/** Fires once when the element first scrolls into view. */
function useInView<T extends HTMLElement>(threshold = 0.25) {
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

function StepCard({ step, index, inView }: { step: Step; index: number; inView: boolean }) {
  const Icon = step.icon;
  return (
    <div
      className={cn(
        // column width = the square, so connector lines run square-to-square;
        // the text below overflows the column width and stays centered.
        "flex w-16 shrink-0 flex-col items-center transition-all duration-700 ease-out motion-reduce:transition-none",
        inView ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
      )}
      style={{ transitionDelay: `${index * 150}ms` }}
    >
      <div
        className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-card shadow-sm"
        style={{ color: ACCENT }}
      >
        <Icon className="h-7 w-7" strokeWidth={2} />
      </div>
      <div className="mt-5 w-40 text-center">
        <h3 className="text-sm font-semibold leading-snug">{step.title}</h3>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{step.body}</p>
      </div>
    </div>
  );
}

function StepConnector({ index, inView }: { index: number; inView: boolean }) {
  return (
    <div
      className="mt-8 flex flex-1 items-center transition-opacity duration-500 ease-out motion-reduce:transition-none"
      style={{ opacity: inView ? 1 : 0, transitionDelay: `${index * 150 + 120}ms` }}
      aria-hidden="true"
    >
      <div className="h-0.5 flex-1" style={{ backgroundColor: GREEN }} />
      <svg width="11" height="12" viewBox="0 0 11 12" className="-ml-px shrink-0">
        <path d="M1 0 L11 6 L1 12 Z" fill={GREEN} />
      </svg>
    </div>
  );
}

/** Trailing status badge: grey spinner while pending, green check on success. */
function StatusBadge({ step }: { step: StatusStep }) {
  if (step.tone === "success") {
    return (
      <CheckCircle2
        className="h-4 w-4 text-[oklch(0.62_0.15_155)]"
        strokeWidth={2.5}
        aria-label="resolved"
      />
    );
  }
  return (
    <Loader2
      className="h-4 w-4 animate-spin text-muted-foreground motion-reduce:animate-none"
      strokeWidth={2.5}
      aria-label="in progress"
    />
  );
}

/** One platform row that walks its own state timeline, then asks the parent to
 *  swap in the next platform once it resolves. Layout: logo · status (left) ·
 *  name (right) · status badge (end). */
function PlatformSlot({
  platform,
  slot,
  inView,
  startDelay,
  onResolved,
}: {
  platform: PlatformDef;
  slot: number;
  inView: boolean;
  startDelay: number;
  onResolved: (slot: number) => void;
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!inView) return;
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (fn: () => void, delay: number) =>
      timers.push(setTimeout(() => !cancelled && fn(), delay));

    setStepIndex(0);
    setVisible(false);

    let t = startDelay;
    at(() => setVisible(true), t + 40);
    platform.steps.forEach((s, idx) => {
      if (idx > 0) at(() => setStepIndex(idx), t);
      t += s.ms;
    });
    // terminal state has lingered → fade out, then request the next platform
    at(() => setVisible(false), t);
    at(() => onResolved(slot), t + 480);

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [platform, slot, inView, startDelay, onResolved]);

  // On swap the new platform may have fewer steps than the current index until
  // the effect resets it, so fall back to the first step to avoid a crash.
  const step = platform.steps[stepIndex] ?? platform.steps[0];
  const Icon = platform.icon;

  return (
    <div
      className={cn(
        "flex h-11 items-center gap-2.5 rounded-lg border border-border bg-card px-3 shadow-sm transition-all duration-500 ease-out motion-reduce:transition-none",
        visible ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0",
      )}
    >
      <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-md", platform.tile)}>
        <Icon className="h-3.5 w-3.5" strokeWidth={2.25} />
      </span>
      <span className="flex-1 truncate text-sm font-medium">{platform.name}</span>
      <span
        key={step.label}
        className={cn(
          "shrink-0 truncate text-right text-[0.72rem] duration-300 animate-in fade-in-0 slide-in-from-bottom-1 motion-reduce:animate-none",
          step.tone === "success" ? "font-medium text-[oklch(0.62_0.15_155)]" : "text-muted-foreground",
        )}
      >
        {step.label}
      </span>
      <span
        key={`${stepIndex}-${step.tone}`}
        className="flex shrink-0 items-center duration-300 animate-in fade-in-0 zoom-in-75 motion-reduce:animate-none"
      >
        <StatusBadge step={step} />
      </span>
    </div>
  );
}

/** Accent row hinting at the long tail of monitored marketplaces. */
function MoreRow({ inView, delay = 0 }: { inView: boolean; delay?: number }) {
  return (
    <div
      className={cn(
        "flex h-11 items-center gap-2.5 rounded-lg border border-dashed border-border px-3 transition-all duration-500 ease-out motion-reduce:transition-none",
        inView ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0",
      )}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[0.6rem] font-bold text-white"
        style={{ backgroundColor: ACCENT }}
      >
        99+
      </span>
      <span className="flex-1 truncate text-[0.72rem] text-muted-foreground">more marketplaces monitored</span>
      <span className="shrink-0 text-sm font-medium" style={{ color: ACCENT }}>
        Live
      </span>
      <span className="relative flex h-2.5 w-2.5 shrink-0 items-center justify-center">
        <span
          className="auth-ping-soft absolute inline-flex h-full w-full rounded-full motion-reduce:animate-none"
          style={{ backgroundColor: ACCENT }}
        />
        <span className="relative inline-flex h-2 w-2 rounded-full" style={{ backgroundColor: ACCENT }} />
      </span>
    </div>
  );
}

/** Live, self-cycling list of platform takedowns. */
function LivePlatformFeed({ inView }: { inView: boolean }) {
  const [slots, setSlots] = useState<number[]>(() =>
    Array.from({ length: SLOT_COUNT }, (_, i) => i),
  );
  const [ready, setReady] = useState(false);
  const nextRef = useRef(SLOT_COUNT);

  // Hold the feed back until the steps + branch have animated in.
  useEffect(() => {
    if (!inView || ready) return;
    const t = setTimeout(() => setReady(true), FEED_REVEAL_DELAY);
    return () => clearTimeout(t);
  }, [inView, ready]);

  const resolveSlot = useCallback((slot: number) => {
    setSlots((prev) => {
      const inUse = new Set(prev);
      let n = nextRef.current % POOL.length;
      let guard = 0;
      while (inUse.has(n) && guard < POOL.length) {
        n = (n + 1) % POOL.length;
        guard += 1;
      }
      nextRef.current = n + 1;
      const copy = [...prev];
      copy[slot] = n;
      return copy;
    });
  }, []);

  return (
    <div className="space-y-2">
      {slots.map((poolIndex, slot) => (
        <PlatformSlot
          key={slot}
          slot={slot}
          platform={POOL[poolIndex]}
          inView={ready}
          startDelay={slot * 180}
          onResolved={resolveSlot}
        />
      ))}
      <MoreRow inView={ready} delay={SLOT_COUNT * 180 + 150} />
    </div>
  );
}

/** Branches from the final step into each platform row. Drawn at the panel's
 *  exact pixel size (no aspect distortion) so arrowheads always land cleanly on
 *  the row centers. Origin sits at the step-icon level (y = ICON_CENTER). */
function FanConnector({ inView }: { inView: boolean }) {
  const W = FAN_WIDTH;
  const OY = ICON_CENTER;
  return (
    <svg
      width={W}
      height={PANEL_HEIGHT}
      viewBox={`0 0 ${W} ${PANEL_HEIGHT}`}
      className="overflow-visible"
      aria-hidden="true"
    >
      <circle
        cx={0}
        cy={OY}
        r={3.5}
        fill={GREEN}
        style={{ opacity: inView ? 1 : 0, transition: "opacity 0.4s ease-out 0.5s" }}
      />
      {ROW_CENTERS.map((y, i) => (
        <g key={y}>
          <path
            d={`M0,${OY} C${W * 0.62},${OY} ${W * 0.38},${y} ${W},${y}`}
            fill="none"
            stroke={GREEN}
            strokeWidth={2}
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray={1}
            style={{
              strokeDashoffset: inView ? 0 : 1,
              transition: "stroke-dashoffset 0.55s ease-out",
              transitionDelay: `${650 + i * 90}ms`,
            }}
          />
          <path
            d={`M${W - 7},${y - 4} L${W},${y} L${W - 7},${y + 4} Z`}
            fill={GREEN}
            style={{
              opacity: inView ? 1 : 0,
              transition: "opacity 0.3s ease-out",
              transitionDelay: `${1000 + i * 90}ms`,
            }}
          />
        </g>
      ))}
    </svg>
  );
}

export function Workflow() {
  const { ref, inView } = useInView<HTMLElement>();

  return (
    <section
      ref={ref}
      id="how"
      className="relative scroll-mt-10 overflow-hidden border-b border-border bg-background py-14 md:py-20"
    >
      {/* Sketchy graph-paper texture */}
      <div className="auth-grain sketch-bg pointer-events-none absolute inset-0" aria-hidden="true" />

      <div className="relative mx-auto max-w-[88rem] px-6 md:px-16 lg:px-24">
        <div
          className={cn(
            "transition-all duration-700 ease-out motion-reduce:transition-none ",
            inView ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
          )}
        >
          <div className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: ACCENT }}>
            How it works
          </div>
          <h2 className="mt-3 text-3xl font-bold leading-tight tracking-tight md:text-4xl">
            From detection to takedown, in one streamlined workflow.
          </h2>
        </div>

        {/* ── Desktop band: pipeline → branch → platform results ── */}
        <div className="mt-16 hidden items-start xl:flex">
          <div className="flex flex-1 items-start">
            {STEPS.map((step, i) => (
              <Fragment key={step.title}>
                <StepCard step={step} index={i} inView={inView} />
                {i < STEPS.length - 1 && <StepConnector index={i} inView={inView} />}
              </Fragment>
            ))}
            {/* green stub carrying the flow from the last step into the branch */}
            <div
              className="ml-2 mt-8 h-0.5 w-6 shrink-0 origin-left motion-reduce:transition-none"
              style={{
                backgroundColor: GREEN,
                transform: inView ? "scaleX(1)" : "scaleX(0)",
                transition: "transform 0.5s ease-out",
                transitionDelay: `${(STEPS.length - 1) * 150 + 120}ms`,
              }}
              aria-hidden="true"
            />
          </div>

          <div className="shrink-0" style={{ width: FAN_WIDTH }}>
            <FanConnector inView={inView} />
          </div>

          <div className="w-80 shrink-0">
            <LivePlatformFeed inView={inView} />
          </div>
        </div>

        {/* ── Stacked layout for narrower screens ── */}
        <div className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:hidden">
          {STEPS.map((step) => (
            <div key={step.title} className="flex items-start gap-4">
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border bg-card"
                style={{ color: ACCENT }}
              >
                <step.icon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold leading-snug">{step.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{step.body}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 max-w-md xl:hidden">
          <LivePlatformFeed inView={inView} />
        </div>
      </div>
    </section>
  );
}
