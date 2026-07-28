import {
  ShoppingCart,
  ShoppingBag,
  Tag,
  Store,
  Instagram,
  Facebook,
  Music2,
  Youtube,
  Globe,
  Apple,
  Package,
  ArrowRight,
} from "lucide-react";
import { BlueprintOverlay } from "./blueprint";
import { Reveal } from "./reveal";
import { useLeadModals } from "./lead-modals";

const CHANNELS = [
  { name: "Amazon", icon: ShoppingCart },
  { name: "Shopify", icon: ShoppingBag },
  { name: "eBay", icon: Tag },
  { name: "Alibaba", icon: Store },
  { name: "Instagram", icon: Instagram },
  { name: "Facebook", icon: Facebook },
  { name: "TikTok", icon: Music2 },
  { name: "YouTube", icon: Youtube },
  { name: "Etsy", icon: Package },
  { name: "App Stores", icon: Apple },
  { name: "Web domains", icon: Globe },
  { name: "AliExpress", icon: ShoppingBag },
];

export function Coverage() {
  const { openDemo } = useLeadModals();

  return (
    <section
      id="coverage"
      className="technical-paper technical-paper--dark relative overflow-hidden border-b border-white/10 py-20 md:py-24"
    >
      <BlueprintOverlay variant="coverage" />
      {/* Soft cartographic glow so the tiles read as returns on a monitoring map. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 60% 55% at 50% 45%, rgba(24,200,137,0.08), transparent 70%)",
        }}
      />

      <div className="relative mx-auto max-w-6xl px-6">
        <div className="max-w-2xl">
          <Reveal
            as="p"
            className="font-mono text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400"
          >
            Comprehensive multi-channel surveillance
          </Reveal>
          <Reveal
            as="h2"
            delay={60}
            className="mt-4 font-display text-3xl font-bold leading-[1.05] tracking-tight sm:text-5xl md:text-6xl"
          >
            Every market.
            <br />
            Every channel.
            <br />
            One watchlist.
          </Reveal>
          <Reveal as="p" delay={120} className="mt-5 max-w-lg text-base text-slate-300/80">
            Continuous AI monitoring across marketplaces, social platforms, domains, and app
            ecosystems — one workspace watching them all.
          </Reveal>
          <Reveal delay={160}>
            <button
              type="button"
              onClick={openDemo}
              className="group mt-7 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:border-white/40 hover:bg-white/10"
            >
              View coverage details
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          </Reveal>
        </div>

        {/* Channel tiles — reveal in a gentle diagonal wave. */}
        <div className="mt-14 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {CHANNELS.map((c, i) => {
            const Icon = c.icon;
            // Diagonal stagger: (row + col) drives the wave across the grid.
            const col = i % 4;
            const row = Math.floor(i / 4);
            return (
              <Reveal
                key={c.name}
                delay={(col + row) * 55}
                y={14}
                className="group flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-sm transition-all hover:-translate-y-[3px] hover:border-white/25 hover:bg-white/[0.06]"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-200 transition-transform group-hover:translate-x-px">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="text-sm font-medium text-slate-100">{c.name}</span>
                <span
                  className="ml-auto h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: "var(--mint, #18c889)" }}
                />
              </Reveal>
            );
          })}
        </div>

        <Reveal delay={120} className="mt-8 flex justify-end">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 font-mono text-[11px] text-slate-300">
            <span
              className="h-1.5 w-1.5 animate-pulse rounded-full"
              style={{ backgroundColor: "var(--mint, #18c889)" }}
            />
            12 channels monitored · 24/7 active
          </span>
        </Reveal>
      </div>
    </section>
  );
}
