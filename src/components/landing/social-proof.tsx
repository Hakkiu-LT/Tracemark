import { Quote } from "lucide-react";
import { CountUp } from "./count-up";
import { Reveal } from "./reveal";

/**
 * Social proof (SS2) — headline monitoring metrics count up as they scroll into
 * view, paired with a customer testimonial. Sits between the hero/product proof
 * and the deeper platform sections so the numbers land before the mechanics.
 *
 * TODO: swap the metrics + quote for verified, attributable figures before launch.
 */

const STATS: {
  to: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  separator?: string;
  label: string;
}[] = [
  { to: 1842, separator: ",", label: "Channels under continuous watch" },
  { to: 99.4, decimals: 1, suffix: "%", label: "Average match confidence on flags" },
  { to: 4, prefix: "< ", suffix: "h", label: "Median detection to notice dispatched" },
  { to: 12, label: "Marketplaces and social platforms" },
];

export function SocialProof() {
  return (
    <section
      id="proof-metrics"
      className="technical-paper relative border-b border-border/60 py-20 md:py-24"
    >
      <div className="relative mx-auto max-w-6xl px-6">
        <div className="grid gap-10 lg:grid-cols-[1.25fr_1fr] lg:gap-16">
          {/* Metrics — 2×2 grid, each figure counts up on reveal */}
          <dl className="grid grid-cols-2 gap-x-8 gap-y-10">
            {STATS.map((s, i) => (
              <Reveal as="div" key={s.label} delay={i * 90} className="border-t border-border/70 pt-4">
                <dd className="font-display text-4xl font-extrabold tracking-tight tabular-nums text-foreground sm:text-5xl">
                  <CountUp
                    to={s.to}
                    decimals={s.decimals}
                    prefix={s.prefix}
                    suffix={s.suffix}
                    separator={s.separator}
                  />
                </dd>
                <dt className="mt-3 text-sm leading-relaxed text-muted-foreground">{s.label}</dt>
              </Reveal>
            ))}
          </dl>

          {/* Testimonial */}
          <Reveal
            as="figure"
            delay={120}
            y={24}
            className="flex flex-col justify-between gap-6 rounded-2xl border border-border/80 bg-card p-7 shadow-sm transition-shadow duration-500 hover:shadow-md md:p-8"
          >
            <Quote className="h-6 w-6" style={{ color: "var(--mint, #18c889)" }} />
            <blockquote className="text-pretty text-lg font-medium leading-relaxed text-foreground md:text-xl">
              “We went from chasing screenshots in a shared drive to a signed evidence packet per
              case. Our outside counsel stopped asking for context.”
            </blockquote>
            <figcaption className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">Head of Legal</span> · consumer
              electronics brand, Vilnius
            </figcaption>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
