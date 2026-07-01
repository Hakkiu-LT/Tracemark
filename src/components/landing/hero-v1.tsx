import { Link } from "@tanstack/react-router";
import { Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InfringementMap } from "@/components/auth/infringement-map";

const stats = [
  { value: "24/7", label: "Always on coverage" },
  { value: "<5 min", label: "Detection to alert" },
  { value: "87%", label: "Infringements found" },
  { value: "12+", label: "Markets monitored" },
];

export function HeroV1() {
  return (
    <section className="relative flex min-h-screen flex-col overflow-hidden border-b border-border bg-background py-10 pl-6 pr-0 text-foreground md:pl-16 lg:pl-24 xl:pl-32">
      <div className="grid flex-1 gap-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-20">
        {/* Text */}
        <div className="flex flex-col justify-center">
          <div className="inline-flex max-w-max items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-[oklch(0.58_0.18_255)]">
            <Sparkles className="h-3.5 w-3.5" />
            Trademark & brand protection, automated
          </div>
          <h1 className="mt-6 text-5xl font-bold leading-[1.02] tracking-tight md:text-6xl">
            Global brand
            <br />
            protection,
            <br />
            <span className="text-[oklch(0.58_0.18_255)]">automated.</span>
          </h1>
          <p className="mt-6 max-w-md text-lg text-muted-foreground">
            AI-powered monitoring finds infringements everywhere. We detect,
            document, and report — so you can focus on growing your brand.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/dashboard">
                Start monitoring
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href="#how">See how it works</a>
            </Button>
          </div>
        </div>

        {/* Live infringement map — blends seamlessly into the page */}
        <div className="relative h-full min-h-[360px]">
          <InfringementMap transparent />
        </div>
      </div>

      {/* Stats — full width below text and map */}
      <div className="mt-10 grid grid-cols-2 gap-6 border-t border-border pt-8 pr-6 md:grid-cols-4 md:pr-16 lg:pr-24 xl:pr-32">
        {stats.map((s) => (
          <div key={s.label}>
            <div className="text-3xl font-bold tracking-tight md:text-4xl">{s.value}</div>
            <div className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">
              {s.label}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}