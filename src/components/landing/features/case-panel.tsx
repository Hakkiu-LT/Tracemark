import {
  Folder,
  MoreHorizontal,
  ShieldCheck,
  FileText,
  Clock,
  Link2,
  CalendarDays,
  Lock,
  FileDown,
  Globe,
  AlertTriangle,
  CheckCircle2,
  Image as ImageIcon,
  Camera,
  Maximize2,
  ScanLine,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import shopListingUrl from "./ShopListing.png?url";
import igFakeUrl from "./IGFake.png?url";

const ACCENT = "oklch(0.58 0.18 255)";
const GREEN = "oklch(0.62 0.15 155)";

interface CaseTimes {
  /** Full date + time strings, e.g. "July 1, 2026 at 10:43 AM". */
  caseCreated: string;
  suspiciousCaptured: string;
  screenshotCaptured: string;
  /** Date-only strings, e.g. "July 1, 2026". */
  originalVerified: string;
  seen: string;
}

const fmtDate = (d: Date) =>
  d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
const fmtTime = (d: Date) =>
  d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
const fmtDateTime = (d: Date) => `${fmtDate(d)} at ${fmtTime(d)}`;

// Static fallback used for the very first render so server- and client-rendered
// markup match; replaced with live "now"-relative stamps once mounted.
const FALLBACK_TIMES: CaseTimes = {
  caseCreated: "May 22, 2025 at 10:43 AM",
  suspiciousCaptured: "May 22, 2025 at 10:38 AM",
  screenshotCaptured: "May 22, 2025 at 10:42 AM",
  originalVerified: "May 22, 2025",
  seen: "May 22, 2025",
};

/** Stamps the case as if it were assembled right now, with the items captured a
 *  few minutes before the case was sealed. */
function useCaseTimes(): CaseTimes {
  const [times, setTimes] = useState<CaseTimes>(FALLBACK_TIMES);
  useEffect(() => {
    const now = new Date();
    const minus = (mins: number) => new Date(now.getTime() - mins * 60_000);
    setTimes({
      caseCreated: fmtDateTime(now),
      suspiciousCaptured: fmtDateTime(minus(5)),
      screenshotCaptured: fmtDateTime(minus(1)),
      originalVerified: fmtDate(minus(3)),
      seen: fmtDate(now),
    });
  }, []);
  return times;
}

const CARD =
  "rounded-2xl bg-white shadow-lg shadow-slate-900/10 ring-1 ring-slate-900/[0.07] dark:bg-slate-900 dark:ring-white/10";

/** Dotted connector that bridges two adjacent cards, mirroring the case graph. */
function Dash({ vertical = false, className }: { vertical?: boolean; className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        vertical
          ? "w-px border-l border-dashed border-slate-300 dark:border-white/15"
          : "h-px flex-1 self-center border-t border-dashed border-slate-300 dark:border-white/15",
        className,
      )}
    />
  );
}

/** Small rounded icon tile used in card headers (violet by default, blue globe variant). */
function Tile({
  icon: Icon,
  variant = "violet",
}: {
  icon: LucideIcon;
  variant?: "violet" | "blue";
}) {
  return (
    <span
      className={cn(
        "flex h-6 w-6 shrink-0 items-center justify-center rounded-lg",
        variant === "blue" ? "bg-blue-500 text-white" : "",
      )}
      style={
        variant === "violet"
          ? { backgroundColor: "oklch(0.58 0.18 255 / 0.12)", color: ACCENT }
          : undefined
      }
    >
      <Icon className="h-3 w-3" strokeWidth={2.25} />
    </span>
  );
}

function Pill({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "violet" | "blue" | "green" | "red";
}) {
  const tones: Record<string, string> = {
    violet: "",
    blue: "bg-blue-500/12 text-blue-600 dark:text-blue-400",
    green: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
    red: "bg-rose-500/12 text-rose-600 dark:text-rose-400",
  };
  return (
    <span
      className={cn(
        "inline-block rounded-md px-1.5 py-0.5 text-[0.6rem] font-semibold leading-none",
        tones[tone],
      )}
      style={
        tone === "violet"
          ? { backgroundColor: "oklch(0.58 0.18 255 / 0.12)", color: ACCENT }
          : undefined
      }
    >
      {children}
    </span>
  );
}

/* ── Evidence cards ───────────────────────────────────────────────────────── */

function SuspiciousListingCard({ capturedAt }: { capturedAt: string }) {
  return (
    <div
      className={cn(
        CARD,
        "flex w-[46%] shrink-0 flex-col overflow-hidden border-2 border-rose-300 ring-0 dark:border-rose-500/40",
      )}
    >
      <div className="flex items-center gap-2 px-3 pt-2.5">
        <Tile icon={Globe} variant="blue" />
        <span className="flex-1 truncate text-[0.72rem] font-semibold text-slate-900 dark:text-white">
          Suspicious product listing
        </span>
        <MoreHorizontal className="h-3.5 w-3.5 shrink-0 text-slate-400" />
      </div>
      <div className="flex gap-2.5 px-3 py-2.5">
        <div className="h-14 w-[40%] shrink-0 overflow-hidden rounded-lg bg-white">
          {/* Crop to the hero sneaker photo — the source PNG is a full card. */}
          <img
            src={shopListingUrl}
            alt="Captured listing"
            className="h-full w-full object-cover"
            style={{ objectPosition: "50% 30%" }}
            loading="lazy"
          />
        </div>
        <div className="min-w-0 space-y-1">
          <Pill tone="violet">High confidence</Pill>
          <p className="text-[0.66rem] leading-tight text-slate-900 dark:text-white">
            <span className="font-semibold">$19.99</span>{" "}
            <span className="text-emerald-600 dark:text-emerald-400">Free shipping</span>
          </p>
          <p className="truncate text-[0.6rem] text-slate-500 dark:text-slate-400">
            Seller: fila.official.shop
          </p>
          <span className="inline-flex items-center gap-1 rounded-md bg-rose-500/10 px-1.5 py-0.5 text-[0.58rem] font-medium text-rose-600 dark:text-rose-400">
            <AlertTriangle className="h-2.5 w-2.5" strokeWidth={2.5} />
            Suspicious seller
          </span>
        </div>
      </div>
      <div className="mt-auto flex items-center gap-2 border-t border-slate-100 px-3 py-1.5 dark:border-white/10">
        <span className="flex-1 truncate text-[0.56rem] text-slate-400">
          Captured {capturedAt}
        </span>
        <ScanLine className="h-3 w-3 shrink-0 text-slate-300 dark:text-slate-600" />
      </div>
    </div>
  );
}

function OriginalProductCard({ verifiedAt }: { verifiedAt: string }) {
  return (
    <div className={cn(CARD, "flex w-[46%] shrink-0 flex-col overflow-hidden")}>
      <div className="flex items-center gap-2 px-3 pt-2.5">
        <Tile icon={ImageIcon} />
        <span className="flex-1 whitespace-nowrap text-[0.72rem] font-semibold text-slate-900 dark:text-white">
          Original branded product
        </span>
        <CheckCircle2 className="h-4 w-4 shrink-0 text-blue-500" strokeWidth={2.25} />
      </div>
      <div className="flex gap-2.5 px-3 py-2.5">
        <div className="h-14 w-[40%] shrink-0 overflow-hidden rounded-lg bg-white">
          {/* Crop to the hero sneaker photo — the source PNG is a full card. */}
          <img
            src={shopListingUrl}
            alt="Original branded product"
            className="h-full w-full object-cover"
            style={{ objectPosition: "50% 28%" }}
            loading="lazy"
          />
        </div>
        <div className="flex min-w-0 flex-col justify-center">
          <p className="text-[0.72rem] font-semibold leading-tight text-slate-900 dark:text-white">
            FILA Shadow Black Sneakers
          </p>
          <p className="mt-0.5 text-[0.62rem] text-slate-500 dark:text-slate-400">fila.com</p>
          <span className="mt-1.5 inline-flex w-fit items-center gap-1 rounded-md bg-blue-500/10 px-1.5 py-0.5 text-[0.58rem] font-medium text-blue-600 dark:text-blue-400">
            <CheckCircle2 className="h-2.5 w-2.5" strokeWidth={2.5} />
            Verified original
          </span>
        </div>
      </div>
      <div className="mt-auto flex items-center gap-2 border-t border-slate-100 px-3 py-1.5 dark:border-white/10">
        <span className="flex-1 truncate text-[0.56rem] text-slate-400">
          Verified {verifiedAt} · brand registry
        </span>
        <ShieldCheck className="h-3 w-3 shrink-0 text-slate-300 dark:text-slate-600" />
      </div>
    </div>
  );
}

function ScreenshotCard({ capturedAt }: { capturedAt: string }) {
  return (
    <div className={cn(CARD, "flex w-[33%] shrink-0 flex-col overflow-hidden")}>
      <div className="flex items-center gap-2 px-3 pt-2.5">
        <Tile icon={Camera} />
        <span className="flex-1 truncate text-[0.72rem] font-semibold text-slate-900 dark:text-white">
          Screenshot
        </span>
        <MoreHorizontal className="h-3.5 w-3.5 shrink-0 text-slate-400" />
      </div>
      <div className="px-3 py-2.5">
        <div className="h-20 w-full overflow-hidden rounded-lg bg-white">
          {/* Skip the source PNG's own "Suspicious profile" header bar; frame the
              actual profile data (handle, stats, bio). */}
          <img
            src={igFakeUrl}
            alt="Page screenshot"
            className="h-full w-full object-cover"
            style={{ objectPosition: "50% 17%" }}
            loading="lazy"
          />
        </div>
      </div>
      <div className="mt-auto flex items-center gap-2 border-t border-slate-100 px-3 py-1.5 dark:border-white/10">
        <span className="flex-1 truncate text-[0.56rem] text-slate-400">
          Captured {capturedAt}
        </span>
        <Maximize2 className="h-3 w-3 shrink-0 text-slate-300 dark:text-slate-600" />
      </div>
    </div>
  );
}

function DomainCard({ seen }: { seen: string }) {
  return (
    <div className={cn(CARD, "flex w-[31%] shrink-0 flex-col p-3")}>
      <div className="flex items-center gap-2">
        <Tile icon={Globe} variant="blue" />
        <span className="flex-1 truncate text-[0.72rem] font-semibold text-slate-900 dark:text-white">
          Domain / URL
        </span>
        <MoreHorizontal className="h-3.5 w-3.5 shrink-0 text-slate-400" />
      </div>
      <p className="mt-2 break-all font-mono text-[0.64rem] font-semibold leading-tight text-slate-900 dark:text-white">
        fila-official.shop/product/fila-shadow-black
      </p>
      <div className="mt-2 flex items-center gap-1.5">
        <Pill tone="red">Potential abuse</Pill>
        <Pill tone="green">Active</Pill>
      </div>
      <div className="mt-2.5 space-y-0.5">
        <p className="text-[0.58rem] text-slate-500 dark:text-slate-400">First seen: {seen}</p>
        <p className="text-[0.58rem] text-slate-500 dark:text-slate-400">Last seen: {seen}</p>
      </div>
    </div>
  );
}

function MatchedAssetCard() {
  return (
    <div className={cn(CARD, "flex flex-1 flex-col p-3")}>
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 shrink-0" style={{ color: ACCENT }} strokeWidth={2.25} />
        <span className="flex-1 truncate text-[0.72rem] font-semibold text-slate-900 dark:text-white">
          Matched asset type
        </span>
      </div>
      <div className="mt-2">
        <Pill tone="blue">Trademark + Product</Pill>
      </div>
      <div className="mt-2.5 flex items-end justify-between gap-2">
        <div className="min-w-0 space-y-0.5">
          <p className="truncate text-[0.62rem] text-slate-500 dark:text-slate-400">
            Brand: <span className="font-semibold text-slate-900 dark:text-white">FILA</span>
          </p>
          <p className="text-[0.62rem] leading-snug text-slate-500 dark:text-slate-400">
            Asset: <span className="font-semibold text-slate-900 dark:text-white">FILA Shadow Black Sneakers</span>
          </p>
        </div>
        <span className="shrink-0 font-display text-base font-extrabold italic tracking-tight text-[#03234B] dark:text-white">
          FILA
        </span>
      </div>
    </div>
  );
}

/* ── Case summary sidebar ─────────────────────────────────────────────────── */

interface SummaryRow {
  icon: LucideIcon;
  label: string;
  value: string;
}

function CaseSummaryCard({ caseCreated }: { caseCreated: string }) {
  const rows: SummaryRow[] = [
    { icon: FileText, label: "Items collected", value: "5 items" },
    { icon: ShieldCheck, label: "Evidence status", value: "Complete" },
    { icon: Clock, label: "Timestamps verified", value: "All items verified" },
    { icon: Link2, label: "Domains recorded", value: "1 domain" },
    { icon: CalendarDays, label: "Case created", value: caseCreated },
  ];
  return (
    <div className={cn(CARD, "w-[270px] shrink-0 p-4")}>
      <div className="flex items-center gap-2.5">
        <Tile icon={Folder} />
        <span className="flex-1 text-[0.85rem] font-semibold text-slate-900 dark:text-white">
          Case summary
        </span>
        <MoreHorizontal className="h-4 w-4 shrink-0 text-slate-400" />
      </div>

      <div
        className="mt-3.5 flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5"
        style={{
          borderColor: "color-mix(in srgb, oklch(0.62 0.15 155) 35%, transparent)",
          backgroundColor: "color-mix(in srgb, oklch(0.62 0.15 155) 9%, transparent)",
        }}
      >
        <ShieldCheck className="h-4 w-4 shrink-0" style={{ color: GREEN }} strokeWidth={2.25} />
        <span className="text-[0.78rem] font-semibold" style={{ color: GREEN }}>
          Evidence packet ready
        </span>
      </div>

      <ul className="mt-3.5 space-y-3">
        {rows.map((row) => {
          const Icon = row.icon;
          return (
            <li key={row.label} className="flex items-center gap-3">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                style={{ backgroundColor: "oklch(0.58 0.18 255 / 0.1)", color: ACCENT }}
              >
                <Icon className="h-4 w-4" strokeWidth={2} />
              </span>
              <div className="min-w-0 leading-tight">
                <p className="truncate text-[0.78rem] font-semibold text-slate-900 dark:text-white">
                  {row.label}
                </p>
                <p className="truncate text-[0.7rem] text-slate-500 dark:text-slate-400">{row.value}</p>
              </div>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        className="mt-3.5 flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-[0.8rem] font-semibold text-white shadow-sm transition-transform hover:-translate-y-px"
        style={{ backgroundColor: ACCENT }}
      >
        <FileDown className="h-4 w-4" strokeWidth={2.25} />
        Export case PDF
      </button>

      <div className="mt-3 flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-white/5">
        <Lock className="mt-px h-3.5 w-3.5 shrink-0" style={{ color: ACCENT }} strokeWidth={2.25} />
        <span className="text-[0.68rem] leading-snug text-slate-500 dark:text-slate-400">
          All evidence is cryptographically sealed and time-stamped.
        </span>
      </div>
    </div>
  );
}

/**
 * Visual companion to the "Evidence-ready case building" feature card: a live
 * case file — five captured evidence items (the suspicious listing, the original
 * product, a page screenshot, the abusive domain, and the matched brand asset)
 * wired together and rolled up into a sealed, timestamped Case summary packet.
 */
export function CasePanel() {
  const times = useCaseTimes();
  return (
    <div className="flex w-full gap-6 items-center">
      {/* Left: heading + evidence-card graph */}
      <div className="min-w-0 flex-1">
        <h3 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
          Evidence-ready case building
        </h3>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
          Automatically collect, organize, and verify all the proof you need. Build airtight cases
          with timestamped evidence that's ready for enforcement.
        </p>

        <div className="mt-8 flex flex-col">
          {/* Row 1 */}
          <div className="flex items-stretch">
            <SuspiciousListingCard capturedAt={times.suspiciousCaptured} />
            <Dash className="mx-3" />
            <OriginalProductCard verifiedAt={times.originalVerified} />
          </div>

          {/* Inter-row vertical link under the first column */}
          <div className="flex h-7 pl-[14%]">
            <Dash vertical />
          </div>

          {/* Row 2 */}
          <div className="flex items-stretch">
            <ScreenshotCard capturedAt={times.screenshotCaptured} />
            <Dash className="mx-3" />
            <DomainCard seen={times.seen} />
            <Dash className="mx-3" />
            <MatchedAssetCard />
          </div>
        </div>
      </div>

      {/* Right: sealed case summary, aligned to the top */}
      <CaseSummaryCard caseCreated={times.caseCreated} />
    </div>
  );
}
