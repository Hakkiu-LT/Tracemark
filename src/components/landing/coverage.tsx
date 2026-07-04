import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ShoppingCart,
  Tag,
  ShoppingBag,
  Chrome,
  Globe,
  Facebook,
  Store,
  Asterisk,
  Apple,
  Instagram,
  Music2,
  Package,
  Youtube,
  Play,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import { ScrollVelocity } from "./scroll-velocity";

const ACCENT = "oklch(0.58 0.18 255)";
// Flat panel tone the scrolling chips sit on and fade into at center. Sampled
// between --background and --muted so the center mask leaves no seam.
const PANEL = "oklch(0.972 0.006 255)";

interface Channel {
  name: string;
  icon: LucideIcon;
}

// Two distinct lanes so a glance never sees the same logo twice across rows.
const LANE_TOP: Channel[] = [
  { name: "Amazon", icon: ShoppingCart },
  { name: "eBay", icon: Tag },
  { name: "Shopify", icon: ShoppingBag },
  { name: "Google Shopping", icon: Chrome },
  { name: "Web domains", icon: Globe },
  { name: "Facebook Marketplace", icon: Facebook },
  { name: "Etsy", icon: Store },
  { name: "Walmart", icon: Asterisk },
];

const LANE_BOTTOM: Channel[] = [
  { name: "Apple App Store", icon: Apple },
  { name: "Instagram", icon: Instagram },
  { name: "TikTok", icon: Music2 },
  { name: "AliExpress", icon: Package },
  { name: "YouTube", icon: Youtube },
  { name: "Google Play", icon: Play },
  { name: "App stores", icon: ShoppingBag },
  { name: "Storefronts", icon: Store },
];

function ChannelChip({ name, icon: Icon }: Channel) {
  return (
    <span className="mx-1.5 inline-flex items-center gap-2.5 rounded-2xl border border-border/70 bg-card/80 px-4 py-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] backdrop-blur-sm">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground/65" strokeWidth={1.75} aria-hidden="true" />
      <span className="text-sm font-medium text-muted-foreground/90">{name}</span>
    </span>
  );
}

function Lane({ channels }: { channels: Channel[] }) {
  return (
    <span className="inline-flex items-center pr-3">
      {channels.map((c) => (
        <ChannelChip key={c.name} {...c} />
      ))}
    </span>
  );
}

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

export function Coverage() {
  const reduced = usePrefersReducedMotion();
  // Stilled when the OS prefers reduced motion — the chips stay legible, just static.
  const drift = reduced ? 0 : 26;

  // Edge feathering so chips dissolve into the panel at the viewport margins
  // rather than hard-cutting on the overflow edge.
  const laneMask =
    "linear-gradient(to right, transparent, #000 7%, #000 93%, transparent)";

  return (
    <section
      className="relative overflow-hidden border-y border-border"
      style={{ backgroundColor: "var(--coverage-panel)" }}
      aria-labelledby="coverage-heading"
    >
      {/* Scrolling channel lanes — one drifts each way, both accelerate with scroll. */}
      <div className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2" aria-hidden="true">
        <div className="space-y-5 md:space-y-7">
          <ScrollVelocity
            texts={[<Lane key="top" channels={LANE_TOP} />]}
            velocity={drift}
            numCopies={6}
            parallaxStyle={{ maskImage: laneMask, WebkitMaskImage: laneMask }}
          />
          <ScrollVelocity
            texts={[<Lane key="bottom" channels={LANE_BOTTOM} />]}
            velocity={-drift}
            numCopies={6}
            parallaxStyle={{ maskImage: laneMask, WebkitMaskImage: laneMask }}
          />
        </div>
      </div>

      {/* Center band: hides the lanes behind the headline so it reads cleanly,
          leaving chips visible at the left and right. Kept tight to the heading
          so the chips drift in close rather than sitting at the far margins. */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
        style={{
          background: "linear-gradient(to right, transparent, var(--coverage-panel) 34%, var(--coverage-panel) 66%, transparent)",
        }}
      />

      {/* Headline */}
      <div className="relative mx-auto flex max-w-2xl flex-col items-center px-6 py-24 text-center md:py-28">
      <p
          className="font-mono text-xs font-semibold uppercase tracking-[0.2em]"
          style={{ color: ACCENT }}
        >
          Marketplace coverage
        </p>
        <h2
          id="coverage-heading"
          className="mt-5 font-display text-4xl font-bold leading-[1.05] tracking-tight text-foreground md:text-5xl"
        >
          Coverage across the channels that matter.
        </h2>
        <p className="mt-5 max-w-md text-base leading-relaxed text-muted-foreground">
          Monitor marketplaces, social platforms, web domains, and shopping surfaces
          where infringers operate.
        </p>
        <Link
          to="/plans"
          className="group mt-7 inline-flex items-center gap-2 text-sm font-semibold transition-colors"
          style={{ color: ACCENT }}
        >
          View all supported channels
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </section>
  );
}
