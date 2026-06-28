import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import heroVideoUrl from "./herovid.mp4?url";

const ACCENT = "oklch(0.58 0.18 255)";

const stats = [
  { value: "24/7", label: "Always on" },
  { value: "<5 min", label: "To first alert" },
  { value: "87%", label: "Infringements found" },
  { value: "12+", label: "Markets watched" },
  { value: "99.8%", label: "Worktime" },
];

export function HeroV2() {
  return (
    <section className="relative flex min-h-screen flex-col overflow-hidden bg-black text-white">
      {/* Looping, darkened surveillance feed */}
      <video
        className="absolute inset-0 h-full w-full object-cover"
        src={heroVideoUrl}
        autoPlay
        loop
        muted
        playsInline
        aria-hidden="true"
      />
      {/* Darkening: flat dim + directional gradient for headline contrast */}
      <div className="absolute inset-0 bg-black/55" aria-hidden="true" />
      <div
        className="absolute inset-0 bg-gradient-to-tr from-black/85 via-black/45 to-black/25"
        aria-hidden="true"
      />

      {/* HUD corner ticks — you're looking through Tracemark's lens */}
      <div className="pointer-events-none absolute inset-5 z-10 md:inset-8" aria-hidden="true">
        <span className="absolute left-0 top-14 h-5 w-5 border-l border-t border-white/30" />
        <span className="absolute right-0 top-14 h-5 w-5 border-r border-t border-white/30" />
        <span className="absolute bottom-0 left-0 h-5 w-5 border-b border-l border-white/30" />
        <span className="absolute bottom-0 right-0 h-5 w-5 border-b border-r border-white/30" />
      </div>

      {/* Top telemetry bar — sits below the fixed nav */}
      <div className="relative z-20 top-5 px-6 pt-20 md:px-16 md:pt-24 lg:px-24 xl:px-32">
        <div className="flex items-center justify-between gap-4 font-mono text-[11px] uppercase tracking-[0.18em] text-white/60">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span
                className="absolute inline-flex h-full w-full rounded-full opacity-75 motion-safe:animate-ping"
                style={{ backgroundColor: ACCENT }}
              />
              <span
                className="relative inline-flex h-2 w-2 rounded-full"
                style={{ backgroundColor: ACCENT }}
              />
            </span>
            <span className="text-white/80">Live</span>
            <span className="hidden sm:inline">· Scanning 12 markets</span>
          </div>
          <span className="hidden md:inline">Feed&nbsp;01 — open web · marketplaces · social</span>
        </div>
      </div>

      {/* Headline block — vertically centered, editorial */}
      <div className="relative z-20 flex flex-1 items-center px-6 py-10 md:px-16 lg:px-24 xl:px-32">
        <div className="max-w-5xl">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-[oklch(0.58_0.18_255)]">
            Always-on · every marketplace
          </p>
          <h1 className="mt-5 font-display text-5xl font-bold leading-[0.98] tracking-tight md:text-7xl">
            Counterfeiters never sleep.
            <br />
            Neither do we.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/70">
            Tracemark watches Amazon, Shopify, and the open web around the clock —
            detecting infringements, capturing court-ready evidence, and filing
            takedowns while you focus on the brand.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" className="bg-white text-primary hover:bg-white/90">
              <Link to="/dashboard">
                Start monitoring
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white"
            >
              <a href="#how">See how it works</a>
            </Button>
          </div>
        </div>
      </div>

      {/* Bottom telemetry strip */}
      <div className="relative z-20 px-6 pb-10 md:px-16 md:pb-14 lg:px-24 xl:px-32">
        <dl className="flex flex-wrap items-baseline gap-x-10 gap-y-3 border-t border-white/15 pt-6 font-mono md:gap-x-14 [text-shadow:0_1px_10px_rgba(0,0,0,0.55)]">
          {stats.map((s) => (
            <div key={s.label} className="flex items-baseline gap-2">
              <dt className="sr-only">{s.label}</dt>
              <dd className="font-display text-xl font-semibold tracking-tight text-white">{s.value}</dd>
              <span className="text-[11px] uppercase tracking-[0.14em] text-white/70">
                {s.label}
              </span>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
