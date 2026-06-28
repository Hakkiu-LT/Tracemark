import { ShieldAlert, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import igFakeUrl from "./IGFake.png?url";
import shopListingUrl from "./ShopListing.png?url";

// Boxes are color-coded by the kind of mark the AI matched, not by channel:
// violet flags the FILA logo (device mark), yellow flags the FILA name
// (wordmark). Each tone has a matching infringement notice.
type Tone = "violet" | "yellow";

const TONE: Record<Tone, { box: string; tile: string; pill: string }> = {
  violet: {
    box: "border-violet-500 bg-violet-500/15",
    tile: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
    pill: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  },
  yellow: {
    box: "border-yellow-400 bg-yellow-400/15",
    tile: "bg-yellow-400/15 text-yellow-600 dark:text-yellow-400",
    pill: "bg-yellow-400/20 text-yellow-700 dark:bg-yellow-400/15 dark:text-yellow-300",
  },
};

// A detection box drawn over a flagged trademark spot. Coordinates are a
// percentage of the capture, so they ride along with the card's tilt.
interface Box {
  top: string;
  left: string;
  width: string;
  height: string;
  tone: Tone;
}

interface Capture {
  src: string;
  alt: string;
  className: string;
  rotate: string;
  boxes: Box[];
}

// Static mock captures, hardcoded in the features folder. Boxes mark where the
// AI located the misused FILA logo (violet) and name (yellow) on each lookalike.
const CAPTURES: Capture[] = [
  {
    src: igFakeUrl,
    alt: "Flagged lookalike Instagram profile impersonating FILA",
    className: "left-0 top-0",
    rotate: "-3deg",
    boxes: [
      // FILA logo used as the profile avatar.
      { top: "11.5%", left: "4.5%", width: "28.5%", height: "17%", tone: "violet" },
      // "FILA®" brand name in the bio.
      { top: "29.8%", left: "6.5%", width: "16%", height: "3.2%", tone: "yellow" },
      // FILA logo on the white sneaker, grid row 1, column 3.
      { top: "13.8%", left: "35.5%", width: "26%", height: "4.8%", tone: "violet" },
      // FILA logo on the navy cap, grid row 2, column 2.
      { top: "39.6%", left: "6.5%", width: "30%", height: "4.8%", tone: "violet" },
    ],
  },
  {
    src: shopListingUrl,
    alt: "Flagged counterfeit FILA sneaker listing on a marketplace",
    className: "bottom-0 right-0",
    rotate: "3.5deg",
    boxes: [
      // Large FILA logo on the side of the front shoe.
      { top: "37%", left: "36%", width: "17%", height: "8%", tone: "violet" },
      // "FILA Shadow Black Sneakers" title text.
      { top: "83%", left: "3.5%", width: "29%", height: "4.8%", tone: "yellow" },
      // FILA logo on the rear shoe.
      { top: "23%", left: "54%", width: "18%", height: "8%", tone: "violet" },
    ],
  },
];

interface Notice {
  tone: Tone;
  icon: LucideIcon;
  title: string;
  source: string;
  detail: string;
  // Free corner the notice tucks into, opposite the captures' overlap.
  position: string;
}

const NOTICES: Notice[] = [
  {
    tone: "violet",
    icon: ShieldAlert,
    title: "Trademark Logo misuse",
    source: "Images · 5 regions",
    detail: "High confidence",
    position: "right-[-3%] top-0 min-w-fit",
  },
  {
    tone: "yellow",
    icon: ShieldAlert,
    title: "Brand name misuse",
    source: "Wordmark · 2 regions",
    detail: "High confidence",
    position: "bottom-0 left-[-3%]",
  },
];

function DetectionBox({ box }: { box: Box }) {
  return (
    <div
      className={cn("absolute rounded-[3px] border-2", TONE[box.tone].box)}
      style={{ top: box.top, left: box.left, width: box.width, height: box.height }}
    />
  );
}

function FlaggedCapture({ capture }: { capture: Capture }) {
  return (
    <div
      className={cn(
        "absolute w-[54%] overflow-hidden rounded-2xl bg-white shadow-xl shadow-slate-900/15 ring-1 ring-slate-900/10 dark:bg-slate-900 dark:ring-white/10",
        capture.className,
      )}
      style={{ transform: `rotate(${capture.rotate})` }}
    >
      <img src={capture.src} alt={capture.alt} className="block w-full" loading="lazy" />
      {capture.boxes.map((box, i) => (
        <DetectionBox key={i} box={box} />
      ))}
    </div>
  );
}

function NoticeCard({ notice }: { notice: Notice }) {
  const t = TONE[notice.tone];
  const Icon = notice.icon;
  return (
    <div className={cn("absolute z-10 w-[46%]", notice.position)}>
      <div className="rounded-xl bg-white/90 p-3 shadow-xl shadow-slate-900/10 ring-1 ring-slate-900/10 backdrop-blur-md dark:bg-slate-900/90 dark:ring-white/10">
        <div className="flex items-center gap-2.5">
          <div
            className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", t.tile)}
          >
            <Icon className="h-4 w-4" strokeWidth={2.25} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-[0.8rem] font-semibold leading-tight text-slate-900 dark:text-white">
              {notice.title}
            </p>
            <p className="truncate text-[0.68rem] leading-tight text-slate-500 dark:text-slate-400">
              {notice.source}
            </p>
          </div>
        </div>
        <span
          className={cn(
            "mt-2.5 inline-block rounded-md px-1.5 py-0.5 text-[0.62rem] font-semibold",
            t.pill,
          )}
        >
          {notice.detail}
        </span>
      </div>
    </div>
  );
}

/**
 * Visual companion to the "AI infringement detection" feature card: two captured
 * lookalikes (a fake profile and a counterfeit listing) with the misused FILA
 * logo boxed in violet and the FILA name in yellow, each paired with the
 * infringement notice the AI raises for that kind of mark.
 */
export function DetectionPanel() {
  return (
    <div className="relative aspect-square w-full">
      {/* Soft accent glow behind the stack so it reads as a live analysis surface. */}
      <div
        className="pointer-events-none absolute inset-[12%] rounded-full"
        style={{
          background:
            "radial-gradient(circle at center, color-mix(in srgb, oklch(0.58 0.18 255) 14%, transparent) 0%, transparent 70%)",
        }}
        aria-hidden="true"
      />
      {CAPTURES.map((capture) => (
        <FlaggedCapture key={capture.src} capture={capture} />
      ))}
      {NOTICES.map((notice) => (
        <NoticeCard key={notice.tone} notice={notice} />
      ))}
    </div>
  );
}
