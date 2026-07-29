import {
  Activity,
  Sparkles,
  FileCheck,
  Send,
  ArrowRight,
  ShoppingCart,
  Globe,
  Users,
  Store,
  type LucideIcon,
} from "lucide-react";
import { BlueprintOverlay } from "../blueprint";
import { Reveal } from "../reveal";
import { ProgressBar } from "../progress-bar";
import { useLeadModals } from "../lead-modals";

/**
 * Platform architecture (SS3) — a bento grid where each module previews the
 * capability it describes: the AI matcher shows a registered-mark vs counterfeit
 * comparison, surveillance shows live crawl-rate bars, dossiers show sealed
 * evidence fields, and enforcement shows the dispatch chain resolving. All
 * previews are decorative; the copy carries the meaning.
 */

const MINT = "var(--mint, #18c889)";

const CRAWLERS: { icon: LucideIcon; label: string; value: string; unit: string; width: string }[] = [
  { icon: ShoppingCart, label: "Amazon US/EU/JP", value: "14,290", unit: "listings / min", width: "92%" },
  { icon: Globe, label: "Shopify & web domains", value: "8,120", unit: "endpoints / min", width: "68%" },
  { icon: Users, label: "Instagram & TikTok ads", value: "3,840", unit: "profiles / min", width: "41%" },
];

const DOSSIER_ROWS: [string, string][] = [
  ["Screenshot SHA-256", "8f92a4b…c19"],
  ["WHOIS registrar", "NameCheap, Inc."],
  ["Timestamp (UTC)", "2025-05-16 14:32:11"],
];

const DISPATCH: { icon: LucideIcon; label: string }[] = [
  { icon: FileCheck, label: "Dossier" },
  { icon: Store, label: "Amazon IP" },
  { icon: ShoppingCart, label: "Shopify" },
  { icon: Globe, label: "Registrar" },
];

export function Features() {
  const { openDemo } = useLeadModals();

  return (
    <section
      id="features"
      className="technical-paper relative scroll-mt-16 border-b border-border/60 py-20 md:py-24"
    >
      <BlueprintOverlay variant="architecture" />

      <div className="relative mx-auto max-w-6xl px-6">
        {/* Header */}
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <Reveal
              as="p"
              className="font-mono text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground"
            >
              The platform
            </Reveal>
            <Reveal
              as="h2"
              delay={60}
              className="mt-4 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl"
            >
              Monitoring, evidence, and enforcement in one chain of custody.
            </Reveal>
            <Reveal
              as="h3"
              delay={90}
              className="mt-5 font-display text-xl font-bold tracking-tight text-foreground"
            >
              How does AI detect counterfeit listings?
            </Reveal>
            <Reveal as="p" delay={110} className="mt-3 max-w-md text-base leading-relaxed text-muted-foreground">
              Vision and language models compare every listing against your registered marks, so
              modified logos, typosquats and evasive wording get caught — not just exact keyword
              matches.
            </Reveal>
          </div>
          <Reveal
            as="p"
            delay={120}
            className="max-w-sm text-base leading-relaxed text-muted-foreground"
          >
            Nothing is re-entered between steps. Every flag carries its own verifiable trail into
            the notice you send.
          </Reveal>
        </div>

        {/* Bento grid */}
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {/* AI matcher — wide */}
          <Reveal
            delay={0}
            className="flex flex-col gap-5 rounded-2xl border border-border/80 bg-card p-6 shadow-sm transition-all hover:-translate-y-1 hover:border-foreground/30 hover:shadow-md md:col-span-2"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-muted/40 text-foreground">
                  <Sparkles className="h-5 w-5" strokeWidth={2} />
                </span>
                <h3 className="font-display text-lg font-bold tracking-tight text-foreground">
                  AI visual &amp; text matcher
                </h3>
              </div>
              <span
                className="hakkiu-pulse-soft shrink-0 rounded-full border px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider"
                style={{
                  color: MINT,
                  borderColor: `color-mix(in srgb, ${MINT} 35%, transparent)`,
                  backgroundColor: `color-mix(in srgb, ${MINT} 10%, transparent)`,
                }}
              >
                &gt;99% confidence
              </span>
            </div>
            <p className="max-w-lg text-sm leading-relaxed text-muted-foreground">
              Vision and language models compare live listings against your registered trademark
              portfolio to catch modified logos, typo-squats, and evasive copy.
            </p>
            <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
              <div
                className="rounded-lg border p-4 text-center"
                style={{
                  borderColor: `color-mix(in srgb, ${MINT} 30%, transparent)`,
                  backgroundColor: `color-mix(in srgb, ${MINT} 6%, transparent)`,
                }}
              >
                <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Registered mark
                </p>
                <p className="mt-2 font-display text-lg font-bold tracking-tight text-foreground">
                  HAKKIU&reg;
                </p>
              </div>
              <span className="text-center font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                vs
              </span>
              <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-4 text-center">
                <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Detected counterfeit
                </p>
                <p className="mt-2 font-mono text-base font-semibold text-rose-600 dark:text-rose-400">
                  HAKK1U-Outlet
                </p>
              </div>
            </div>
          </Reveal>

          {/* 24/7 surveillance */}
          <Reveal
            delay={100}
            className="flex flex-col gap-5 rounded-2xl border border-border/80 bg-card p-6 shadow-sm transition-all hover:-translate-y-1 hover:border-foreground/30 hover:shadow-md"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-muted/40 text-foreground">
                <Activity className="h-5 w-5" strokeWidth={2} />
              </span>
              <h3 className="font-display text-lg font-bold tracking-tight text-foreground">
                24/7 surveillance
              </h3>
            </div>
            <ul className="flex flex-col gap-4">
              {CRAWLERS.map((c, i) => {
                const Icon = c.icon;
                return (
                  <li key={c.label}>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="flex items-center gap-2 text-sm text-foreground">
                        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                        {c.label}
                      </span>
                      <span className="font-mono text-sm font-medium tabular-nums text-foreground">
                        {c.value}
                      </span>
                    </div>
                    <ProgressBar width={c.width} delay={200 + i * 140} className="mt-2 h-1" />
                    <p className="mt-1.5 font-mono text-[10px] text-muted-foreground">{c.unit}</p>
                  </li>
                );
              })}
            </ul>
          </Reveal>

          {/* Forensic dossiers */}
          <Reveal
            delay={160}
            className="flex flex-col gap-5 rounded-2xl border border-border/80 bg-card p-6 shadow-sm transition-all hover:-translate-y-1 hover:border-foreground/30 hover:shadow-md"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-muted/40 text-foreground">
                <FileCheck className="h-5 w-5" strokeWidth={2} />
              </span>
              <h3 className="font-display text-lg font-bold tracking-tight text-foreground">
                Forensic dossiers
              </h3>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Screenshots, WHOIS records, and cryptographic timestamps sealed for legal review.
            </p>
            <dl className="mt-auto flex flex-col gap-1.5">
              {DOSSIER_ROWS.map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-center justify-between gap-3 rounded-md bg-muted/40 px-3 py-2"
                >
                  <dt className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {label}
                  </dt>
                  <dd className="truncate font-mono text-[11px] text-foreground">{value}</dd>
                </div>
              ))}
            </dl>
          </Reveal>

          {/* One-click enforcement — wide */}
          <Reveal
            delay={100}
            className="flex flex-col gap-5 rounded-2xl border border-border/80 bg-card p-6 shadow-sm transition-all hover:-translate-y-1 hover:border-foreground/30 hover:shadow-md md:col-span-2"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-muted/40 text-foreground">
                  <Send className="h-5 w-5" strokeWidth={2} />
                </span>
                <h3 className="font-display text-lg font-bold tracking-tight text-foreground">
                  1-click marketplace enforcement
                </h3>
              </div>
              <span className="shrink-0 rounded-full border border-border bg-muted/40 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Notice delivered
              </span>
            </div>
            <p className="max-w-lg text-sm leading-relaxed text-muted-foreground">
              Each notice is routed to the right portal, registrar or abuse contact with the
              evidence dossier attached, and every case is tracked in one place through to resolution.
            </p>
            <ol className="flex flex-wrap items-center gap-x-2 gap-y-3">
              {DISPATCH.map((s, i) => {
                const Icon = s.icon;
                return (
                  <li key={s.label} className="flex items-center gap-2">
                    <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs font-medium text-foreground">{s.label}</span>
                    </div>
                    {i < DISPATCH.length - 1 && (
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </li>
                );
              })}
              <li className="flex items-center gap-2">
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                <div
                  className="rounded-lg border px-3 py-2 text-xs font-medium"
                  style={{
                    color: MINT,
                    borderColor: `color-mix(in srgb, ${MINT} 35%, transparent)`,
                    backgroundColor: `color-mix(in srgb, ${MINT} 10%, transparent)`,
                  }}
                >
                  Resolved
                </div>
              </li>
            </ol>
          </Reveal>
        </div>

        <Reveal delay={120} className="mt-12 flex justify-center">
          <button
            type="button"
            onClick={openDemo}
            className="group inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-foreground transition-colors hover:text-accent"
          >
            Review technical architecture
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </button>
        </Reveal>
      </div>
    </section>
  );
}
