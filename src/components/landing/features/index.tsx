import { useEffect, useState } from "react";
import { Activity, Sparkles, FileText, Send, ArrowRight, Check, ShieldCheck, ScanSearch, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { RadarPanel } from "./radar-panel";
import { DetectionPanel } from "./detection-panel";
import { CasePanel } from "./case-panel";

const ACCENT = "oklch(0.58 0.18 255)";

// How long each card stays active before the panel advances to the next one.
const CYCLE_MS = 20000;

interface Feature {
  icon: LucideIcon;
  title: string;
  body: string;
  detail: string;
  points: string[];
}

const FEATURES: Feature[] = [
  {
    icon: Activity,
    title: "Always-on monitoring",
    body: "24/7 monitoring across global channels so nothing slips through the cracks.",
    detail:
      "Our global monitoring network scans marketplaces, social platforms, and web domains 24/7—so you're always ahead of threats.",
    points: [
      "Wide coverage across 70+ channels",
      "Real-time discovery, every few minutes",
      "Global visibility with local precision",
    ],
  },
  {
    icon: Sparkles,
    title: "AI infringement detection",
    body: "Advanced AI finds lookalikes, variations, and evasive listings with high accuracy.",
    detail:
      "Machine learning models compare every listing against your marks, flagging counterfeits, lookalikes, and evasive variations humans miss.",
    points: [
      "Detects visual and textual lookalikes",
      "Catches deliberately obfuscated listings",
      "Confidence scoring on every match",
    ],
  },
  {
    icon: FileText,
    title: "Evidence-ready case building",
    body: "Capture and organize proof automatically with tamper-evident records.",
    detail:
      "Every detection is captured and organized into a clean, tamper-evident record—ready to hand to platforms, counsel, or the courts.",
    points: [
      "Automatic screenshots and metadata capture",
      "Tamper-evident, timestamped records",
      "Export-ready evidence packets",
    ],
  },
  {
    icon: Send,
    title: "Automated takedowns",
    body: "Submit takedowns at scale and track resolution to closure.",
    detail:
      "Submit takedowns at scale across every channel and track each request from filing through to resolution—without the manual busywork.",
    points: [
      "One-click filing across marketplaces",
      "Status tracking through to closure",
      "Bulk actions for high-volume cases",
    ],
  },
];

/** True when the user has asked the OS to minimize motion. */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduced;
}

// Two mirrored groups under the monitoring detail: what we guard vs. what we
// hunt. The eyebrow icon encodes the defensive/detective split; the trailing
// accent "& more" marks each list as non-exhaustive.
function TagGroup({
  icon: Icon,
  label,
  items,
}: {
  icon: LucideIcon;
  label: string;
  items: string[];
}) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 shrink-0" style={{ color: ACCENT }} strokeWidth={2} />
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground/70">
          {label}
        </span>
      </div>
      <ul className="mt-2.5 flex flex-wrap gap-2">
        {items.map((item) => (
          <li
            key={item}
            className="rounded-full border border-border/70 bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground"
          >
            {item}
          </li>
        ))}
        <li className="px-1 py-1 text-xs font-semibold" style={{ color: ACCENT }}>
          &amp; more
        </li>
      </ul>
    </div>
  );
}

function FeatureCard({
  feature,
  active,
  onSelect,
}: {
  feature: Feature;
  active: boolean;
  onSelect: () => void;
}) {
  const Icon = feature.icon;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={cn(
        "group relative w-full overflow-hidden rounded-xl border bg-card/80 p-5 text-left backdrop-blur-sm transition-colors",
        active
          ? "border-[oklch(0.58_0.18_255)] shadow-[0_1px_3px_rgba(15,23,42,0.06)]"
          : "border-border/60 hover:border-[oklch(0.58_0.18_255)]/50",
      )}
    >
      <div className="flex items-center gap-3.5">
        <div
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border transition-colors",
            active
              ? "border-[oklch(0.58_0.18_255)]/30 bg-[oklch(0.58_0.18_255)]/10"
              : "border-border/60 bg-[oklch(0.58_0.18_255)]/5",
          )}
          style={{ color: ACCENT }}
        >
          <Icon className="h-5 w-5" strokeWidth={2} />
        </div>
        <h3 className="min-w-0 flex-1 text-base font-semibold leading-tight">{feature.title}</h3>
        <ArrowRight
          className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5"
          style={{ color: ACCENT }}
        />
      </div>

      {/* Visibility-time progress bar — only on the active card. Keyed by the
          parent so it restarts its fill each time this card becomes active. */}
      {active && (
        <div className="absolute inset-x-0 bottom-0 h-1 bg-[oklch(0.58_0.18_255)]/10" aria-hidden="true">
          <div
            className="feat-progress h-full rounded-full"
            style={{ backgroundColor: ACCENT, animationDuration: `${CYCLE_MS}ms` }}
          />
        </div>
      )}
    </button>
  );
}

export function Features() {
  const reduced = usePrefersReducedMotion();
  const [active, setActive] = useState(0);

  // Auto-advance through the cards on a fixed cadence. Stilled when the OS
  // prefers reduced motion so the panel stays put on the first card.
  useEffect(() => {
    if (reduced) return;
    const t = setTimeout(() => setActive((i) => (i + 1) % FEATURES.length), CYCLE_MS);
    return () => clearTimeout(t);
  }, [active, reduced]);

  return (
    <section
      id="features"
      className="relative scroll-mt-16 overflow-hidden border-b border-border"
    >
      <div className="relative mx-auto max-w-[90rem] px-6 py-20 md:px-10 md:py-24 lg:px-12">
        {/* Header */}
        <div className="max-w-2xl">
          <div className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: ACCENT }}>
            Built for brand protection
          </div>
          <h2 className="mt-3 font-display text-4xl font-bold tracking-tight md:text-5xl">
            Built for brand protection
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
            Four powerful capabilities work together to detect, document, and remove infringing
            activity across the internet.
          </p>
        </div>

        {/* Cards (left) · radar panel (right) */}
        <div className="mt-12 grid items-start gap-6 lg:grid-cols-[1fr_3fr]">
          <div className="flex flex-col gap-3">
            {FEATURES.map((feature, i) => (
              <FeatureCard
                // Re-key on activation so the progress bar restarts its fill.
                key={`${feature.title}-${active === i}`}
                feature={feature}
                active={active === i}
                onSelect={() => setActive(i)}
              />
            ))}
          </div>

          {/* Right panel — detail for the active card, transparent and
              borderless, with the live radar beside it for the first card.
              The case card breaks out into a full-width case-file graph. */}
          <div key={active} className="hidden lg:block">
            {active === 2 ? (
              <CasePanel />
            ) : (
              <div className="flex items-start">
                <div className="flex-1">
                  <h3 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
                    {FEATURES[active].title}
                  </h3>
                  <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                    {FEATURES[active].detail}
                  </p>
                  {active === 0 ? (
                    <div className="mt-7 space-y-5">
                      <TagGroup
                        icon={ShieldCheck}
                        label="Protected assets"
                        items={["Brand name", "Logo", "Product images", "Trademarks"]}
                      />
                      <TagGroup
                        icon={ScanSearch}
                        label="Signals watched"
                        items={[
                          "Logo misuse",
                          "Domain mimicry",
                          "Seller anomaly",
                          "Profile impersonation",
                          "Content misuse",
                        ]}
                      />
                    </div>
                  ) : (
                    <ul className="mt-6 space-y-3">
                      {FEATURES[active].points.map((point) => (
                        <li key={point} className="flex items-center gap-3 text-sm font-medium">
                          <span
                            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                            style={{ backgroundColor: "oklch(0.58 0.18 255 / 0.12)", color: ACCENT }}
                          >
                            <Check className="h-3 w-3" strokeWidth={3} />
                          </span>
                          {point}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {active === 0 && (
                  <div className="flex-1">
                    <RadarPanel />
                  </div>
                )}

                {active === 1 && (
                  <div className="flex-1">
                    <DetectionPanel />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
