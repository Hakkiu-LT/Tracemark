import { useEffect, useState } from "react";
import { Crosshair, CheckCircle2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import worldMapUrl from "./World_map.svg?url";

type Tone = "danger" | "success" | "warning";

interface Detection {
  id: string;
  tone: Tone;
  title: string;
}

const TONE_STYLES: Record<Tone, { text: string; icon: typeof Crosshair; dot: string }> = {
  danger: {
    text: "text-red-500 dark:text-red-400",
    icon: Crosshair,
    dot: "bg-red-500 dark:bg-red-400",
  },
  success: {
    text: "text-emerald-600 dark:text-emerald-400",
    icon: CheckCircle2,
    dot: "ring-2 ring-emerald-500 dark:ring-emerald-400",
  },
  warning: {
    text: "text-amber-500 dark:text-amber-400",
    icon: AlertTriangle,
    dot: "ring-2 ring-amber-500 dark:ring-amber-400",
  },
};

const NOTIFICATIONS: Detection[] = [
  { id: "a1", tone: "danger", title: "3 new infringements detected" },
  { id: "b1", tone: "success", title: "Report submitted" },
  { id: "c1", tone: "warning", title: "Logo misuse detected" },
  { id: "a2", tone: "danger", title: "Counterfeit listing found" },
  { id: "b2", tone: "success", title: "Takedown approved" },
  { id: "c2", tone: "warning", title: "Brand impersonation" },
  { id: "a3", tone: "danger", title: "2 new infringements detected" },
  { id: "b3", tone: "success", title: "Domain seized" },
  { id: "c3", tone: "warning", title: "Trademark abuse flagged" },
];

const POSITIONS = [
  "top-[24%] left-[20%]",
  "top-[38%] left-[32%]",
  "bottom-[29%] right-[15%]",
  "top-[50%] right-[24%]",
  "top-[35%] left-[38%]",
  "top-[28%] left-[40%]",
  "bottom-[34%] left-[14%]",
  "bottom-[24%] right-[10%]",
  "top-[44%] left-[58%]",
];

// Detection pins in the World_map.svg coordinate space.
// Coordinates snapped onto land dots;
const PINS: Array<[number, number]> = [
  [443, 416], // United States
  [931, 351], // Western Europe
  [768, 855], // Brazil
  [720, 985], // Argentina
  [1435, 465], // India
  [1565, 644], // Singapore
  [1857, 368], // Japan
];

// Dashed great-circle-ish arcs between pin indices.
const ARCS: Array<[number, number]> = [
  [0, 1],
  [1, 4],
  [4, 5],
  [0, 2],
  [1, 6],
];

function arcPath(a: [number, number], b: [number, number]): string {
  const x1 = a[0];
  const y1 = a[1];
  const x2 = b[0];
  const y2 = b[1];
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const lift = Math.hypot(x2 - x1, y2 - y1) * 0.28;
  return `M ${x1} ${y1} Q ${mx} ${my - lift} ${x2} ${y2}`;
}

export function InfringementMap() {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setCurrentIndex((v) => (v + 1) % NOTIFICATIONS.length), 5000);
    return () => clearInterval(t);
  }, []);

  const activeNotification = NOTIFICATIONS[currentIndex];
  // Cycle positions alongside notifications
  const positionClass = POSITIONS[currentIndex % POSITIONS.length];

  return (
    <div className="auth-grain relative h-full w-full overflow-hidden bg-[radial-gradient(120%_120%_at_30%_20%,#eef2fb_0%,#e9eefb_55%,#e3e9f7_100%)] dark:bg-[radial-gradient(120%_120%_at_30%_20%,#16213f_0%,#0c1326_55%,#080d1c_100%)]">
      {/* accent glows for depth */}
      <div className="auth-drift pointer-events-none absolute -right-20 top-10 h-72 w-72 rounded-full bg-blue-200/40 blur-3xl dark:bg-accent/25" />
      <div className="pointer-events-none absolute bottom-0 left-10 h-64 w-64 rounded-full bg-indigo-200/30 blur-3xl dark:bg-indigo-500/20" />

      {/* live status badge */}
      <div className="absolute bottom-6 left-6 z-10 flex items-center gap-2 rounded-full border border-black/5 bg-white/70 px-3 py-1.5 backdrop-blur dark:border-white/10 dark:bg-white/5">
        <span className="relative flex h-2 w-2">
          <span className="auth-ping-soft absolute inline-flex h-full w-full rounded-full bg-emerald-500 dark:bg-emerald-400" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500 dark:bg-emerald-400" />
        </span>
        <span className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-slate-600 dark:text-white/70">
          Live monitoring
        </span>
      </div>

      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="relative h-full w-full">
          <img
            src={worldMapUrl}
            alt=""
            className="h-full w-full object-contain opacity-90 dark:opacity-[0.16] dark:filter-[invert(1)_brightness(1.5)]"
            aria-hidden="true"
          />

          <svg
            className="absolute inset-0 h-full w-full"
            viewBox="0 0 2100 1312.5"
            preserveAspectRatio="xMidYMid meet"
            aria-hidden="true"
          >
            <defs>
              <filter id="pin-glow" x="-200%" y="-200%" width="500%" height="500%">
                <feGaussianBlur stdDeviation="10" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* signal arcs */}
            {ARCS.map(([a, b], i) => (
              <path
                key={`arc-${i}`}
                className="stroke-[#8ea7e6] dark:stroke-[#60a5fa]"
                d={arcPath(PINS[a], PINS[b])}
                fill="none"
                strokeWidth={4}
                strokeDasharray="10 16"
                strokeLinecap="round"
                opacity={0.6}
              >
                <animate
                  attributeName="stroke-dashoffset"
                  values="0;-52"
                  dur="3.2s"
                  repeatCount="indefinite"
                />
              </path>
            ))}

            {/* detection pins */}
            {PINS.map(([x, y], i) => {
              return (
                <g key={`pin-${i}`}>
                  <circle
                    className="fill-[#3b82f6] dark:fill-[#60a5fa]"
                    cx={x}
                    cy={y}
                    r={12}
                    opacity={0.4}
                  >
                    <animate
                      attributeName="r"
                      values="12;34;12"
                      dur="2.8s"
                      begin={`${i * 0.4}s`}
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="opacity"
                      values="0.5;0;0.5"
                      dur="2.8s"
                      begin={`${i * 0.4}s`}
                      repeatCount="indefinite"
                    />
                  </circle>
                  <circle
                    className="fill-[#2563eb] dark:fill-[#3b82f6]"
                    cx={x}
                    cy={y}
                    r={9}
                    filter="url(#pin-glow)"
                  />
                  <circle cx={x} cy={y} r={3.5} className="fill-white" />
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* active floating card */}
      <div
        className={cn("absolute w-[min(18rem,72vw)] transition-all duration-1000", positionClass)}
      >
        <FloatingCardItem detection={activeNotification} index={currentIndex} />
      </div>
    </div>
  );
}

function FloatingCardItem({ detection: d, index }: { detection: Detection; index: number }) {
  const tone = TONE_STYLES[d.tone];
  const Icon = tone.icon;

  return (
    <div
      key={`${d.id}-${index}`}
      className="flex items-center gap-2.5 rounded-xl border border-white/60 bg-white/55 px-3.5 py-2.5 shadow-xl shadow-slate-900/10 backdrop-blur-md duration-700 animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-2 dark:border-white/10 dark:bg-white/[0.07] dark:shadow-2xl dark:shadow-black/40"
    >
      <Icon className={cn("h-[1.35rem] w-[1.35rem] shrink-0", tone.text)} strokeWidth={2.75} />
      <p className="min-w-0 flex-1 truncate text-sm font-semibold leading-tight text-slate-900 dark:text-white">
        {d.title}
      </p>
      <span className={cn("h-2 w-2 shrink-0 rounded-full", tone.dot)} />
    </div>
  );
}
