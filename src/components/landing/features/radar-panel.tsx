import { useEffect, useState } from "react";
import { ShieldAlert, Globe, MapPin, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import Radar from "./radar";

const ACCENT_HEX = "#3b82f6";
// Neutral slate for the radar grid; brand accent is reserved for the status pill
// so the disc reads as a calm monitoring surface.
const RADAR_HEX = "#94a3b8";
// Detection flash color.
const ALERT_HEX = "#ef4444";

type Tone = "danger" | "warning";

interface Detection {
  tone: Tone;
  title: string;
  confidence: string;
  url: string;
  country: string;
}

const TONE_STYLES: Record<Tone, { tile: string; pill: string }> = {
  danger: {
    tile: "bg-red-50 text-red-500 dark:bg-red-500/10 dark:text-red-400",
    pill: "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400",
  },
  warning: {
    tile: "bg-amber-50 text-amber-500 dark:bg-amber-500/10 dark:text-amber-400",
    pill: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400",
  },
};

// Detection feed — static mock data, pulled from the infringement map.
const NOTIFICATIONS: Detection[] = [
  {
    tone: "danger",
    title: "Brand impersonation",
    confidence: "High confidence",
    url: "example-fakeshop.com",
    country: "United States",
  },
  {
    tone: "warning",
    title: "Gray market activity",
    confidence: "Medium confidence",
    url: "deals-outlet.net",
    country: "Germany",
  },
  {
    tone: "danger",
    title: "Counterfeit detected",
    confidence: "High confidence",
    url: "luxe-bargains.co",
    country: "China",
  },
  {
    tone: "warning",
    title: "Domain abuse flagged",
    confidence: "Medium confidence",
    url: "secure-login-brand.com",
    country: "Netherlands",
  },
  {
    tone: "danger",
    title: "Piracy detected",
    confidence: "High confidence",
    url: "freestream-hub.tv",
    country: "Spain",
  },
];

// Candidate return positions on the disc (percent of the panel). Each cycle one
// of these flashes red and the matching alert pops in beside it.
const POINTS = [
  { top: "30%", left: "62%" },
  { top: "58%", left: "66%" },
  { top: "66%", left: "42%" },
  { top: "34%", left: "33%" },
  { top: "48%", left: "72%" },
  { top: "70%", left: "54%" },
  { top: "40%", left: "47%" },
];

// How long each detection stays before the next point flashes.
const CYCLE_MS = 3200;

// Anchors the alert card immediately beside its point, flipping to the inner
// side when the point sits on the right half so the card stays on the disc.
function cardStyle(p: { top: string; left: string }): React.CSSProperties {
  const onRight = parseFloat(p.left) >= 50;
  return {
    top: p.top,
    left: onRight ? `calc(${p.left} - 0.85rem)` : `calc(${p.left} + 0.85rem)`,
    transform: onRight ? "translate(-100%, -50%)" : "translate(0, -50%)",
  };
}

export function RadarPanel() {
  // p = which point flashes, n = which detection message shows.
  const [state, setState] = useState({ p: 0, n: 0 });

  useEffect(() => {
    const t = setInterval(() => {
      setState((prev) => {
        let p = Math.floor(Math.random() * POINTS.length);
        if (p === prev.p) p = (p + 1) % POINTS.length;
        return { p, n: (prev.n + 1) % NOTIFICATIONS.length };
      });
    }, CYCLE_MS);
    return () => clearInterval(t);
  }, []);

  const point = POINTS[state.p];
  const detection = NOTIFICATIONS[state.n];

  return (
    <div className="relative aspect-square w-full">
      {/* Soft backdrop glow so the disc reads as a live monitoring screen */}
      <div
        className="pointer-events-none absolute inset-[20%] rounded-full"
        style={{
          background: `radial-gradient(circle at center, color-mix(in srgb, ${RADAR_HEX} 16%, transparent) 0%, transparent 68%)`,
        }}
        aria-hidden="true"
      />

      {/* Radar disc — static grey grid, no rotating sweep */}
      <div className="absolute inset-0">
        <Radar
          speed={0.3}
          scale={1.12}
          ringCount={4}
          spokeCount={12}
          ringThickness={0.03}
          spokeThickness={0.008}
          sweepSpeed={0.7}
          sweepWidth={12}
          sweepLobes={1}
          showSweep={false}
          color={RADAR_HEX}
          backgroundColor="#000000"
          falloff={1.0}
          brightness={1.6}
          enableMouseInteraction={false}
        />
      </div>

      {/* Center pip */}
      <span
        className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ backgroundColor: ACCENT_HEX }}
        aria-hidden="true"
      />

      {/* Ambient returns — faint, static */}
      {POINTS.map((b, i) =>
        i === state.p ? null : (
          <span
            key={i}
            className="pointer-events-none absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-400/40"
            style={{ top: b.top, left: b.left }}
            aria-hidden="true"
          />
        ),
      )}

      {/* Active return — flashes red */}
      <span
        key={state.p}
        className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
        style={{ top: point.top, left: point.left }}
        aria-hidden="true"
      >
        <span
          className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full motion-safe:animate-ping"
          style={{ backgroundColor: ALERT_HEX, opacity: 0.7 }}
        />
        <span
          className="relative block h-2.5 w-2.5 rounded-full"
          style={{
            backgroundColor: ALERT_HEX,
            boxShadow: `0 0 8px 2px color-mix(in srgb, ${ALERT_HEX} 60%, transparent)`,
          }}
        />
      </span>

      {/* Alert card — appears next to the flashing point */}
      <div className="absolute w-[min(15rem,62%)]" style={cardStyle(point)}>
        <NotificationCard key={`${state.p}-${state.n}`} detection={detection} />
      </div>
    </div>
  );
}

function NotificationCard({ detection: d }: { detection: Detection }) {
  const tone = TONE_STYLES[d.tone];
  return (
    <div className="rounded-2xl bg-white/80 p-3.5 shadow-xl shadow-slate-900/10 backdrop-blur-md duration-500 animate-in fade-in-0 zoom-in-95 dark:bg-white/[0.07]">
      <div className="flex items-start gap-3">
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", tone.tile)}>
          <ShieldAlert className="h-5 w-5" strokeWidth={2.25} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-tight text-slate-900 dark:text-white">
            {d.title}
          </p>
          <span className={cn("mt-1.5 inline-block rounded-md px-1.5 py-0.5 text-[0.7rem] font-semibold", tone.pill)}>
            {d.confidence}
          </span>
        </div>
      </div>

      <div className="mt-3 space-y-1.5 text-xs text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-2">
          <Globe className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
          <span className="truncate">{d.url}</span>
        </div>
        <div className="flex items-center gap-2">
          <MapPin className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
          <span className="truncate">{d.country}</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
          <span className="truncate">Detected just now</span>
        </div>
      </div>
    </div>
  );
}
