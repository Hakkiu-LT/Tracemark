import { ArrowRight } from "lucide-react";
import { getPlatformLogo } from "@/lib/platform-logos";
import { Marquee } from "@/components/ui/marquee";
import { BlueprintOverlay } from "./blueprint";
import { Reveal } from "./reveal";
import { useLeadModals } from "./lead-modals";

// Channels shown as real brand logos (all resolve via getPlatformLogo).
const CHANNELS = [
  "Amazon",
  "Shopify",
  "eBay",
  "Alibaba",
  "AliExpress",
  "Etsy",
  "Instagram",
  "TikTok",
  "Facebook",
  "Meta Ads",
  "Google Ads",
  "Web domains",
];

// A single brand chip inside the marquee.
function ChannelChip({ name }: { name: string }) {
  const logo = getPlatformLogo(name);
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-card px-4 py-3 shadow-sm transition-colors hover:border-foreground/30 hover:bg-muted">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/40">
        {logo ? (
          <img src={logo} alt="" className="h-5 w-5 object-contain" loading="lazy" />
        ) : (
          <span className="text-xs font-semibold text-muted-foreground">{name[0]}</span>
        )}
      </span>
      <span className="whitespace-nowrap text-sm font-medium text-foreground">{name}</span>
    </div>
  );
}

export function Coverage() {
  const { openDemo } = useLeadModals();

  return (
    <section
      id="coverage"
      className="technical-paper relative overflow-hidden border-b border-border/60 py-20 md:py-24"
    >
      <BlueprintOverlay variant="coverage" />

      <div className="relative mx-auto max-w-6xl px-6">
        <div className="max-w-2xl">
          <Reveal
            as="p"
            className="font-mono text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground"
          >
            Comprehensive multi-channel surveillance
          </Reveal>
          <Reveal
            as="h2"
            delay={60}
            className="mt-4 font-display text-3xl font-bold leading-[1.05] tracking-tight text-foreground sm:text-5xl md:text-6xl"
          >
            Every market.
            <br />
            Every channel.
            <br />
            One watchlist.
          </Reveal>
          <Reveal as="p" delay={120} className="mt-5 max-w-lg text-base text-muted-foreground">
            Continuous AI monitoring across marketplaces, social platforms, domains, and app
            ecosystems — one workspace watching them all.
          </Reveal>
          <Reveal
            as="h3"
            delay={130}
            className="mt-8 font-display text-xl font-bold tracking-tight text-foreground"
          >
            Which marketplaces and channels does HAKKIU monitor?
          </Reveal>
          <Reveal as="p" delay={145} className="mt-3 max-w-lg text-base text-muted-foreground">
            HAKKIU watches 12+ channels around the clock from a single workspace — the major
            marketplaces (Amazon, Shopify, eBay, Alibaba, AliExpress, Etsy), social and ad
            platforms (Instagram, TikTok, Facebook, Meta and Google ads), and web domains —
            so nothing slips through a gap between separate tools.
          </Reveal>
          <Reveal delay={160}>
            <button
              type="button"
              onClick={openDemo}
              className="group mt-7 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:border-foreground/40 hover:bg-muted"
            >
              View coverage details
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          </Reveal>
        </div>

        {/* Channels scroll past as two opposing marquee rows (magicui Marquee).
            The container is masked so both edges fade to transparent — no visible
            start/end seam, and it works over the transparent grid background. */}
        <Reveal delay={80} className="mt-14">
          <div className="relative [-webkit-mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)] [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
            <Marquee pauseOnHover className="[--duration:34s]">
              {CHANNELS.slice(0, 6).map((name) => (
                <ChannelChip key={name} name={name} />
              ))}
            </Marquee>
            <Marquee reverse pauseOnHover className="mt-1 [--duration:34s]">
              {CHANNELS.slice(6).map((name) => (
                <ChannelChip key={name} name={name} />
              ))}
            </Marquee>
          </div>
        </Reveal>

        <Reveal delay={120} className="mt-8 flex justify-end">
          <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card px-3.5 py-1.5 font-mono text-[11px] text-muted-foreground shadow-sm">
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
