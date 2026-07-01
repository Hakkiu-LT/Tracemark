import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Building2,
  Users,
  Scale,
  CheckCircle2,
  Star,
  Sparkles,
  DollarSign,
  CalendarDays,
  ShieldCheck,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { StarBorder } from "./star-border";

// Brand-blue comet over a neutral grey resting border on the assurance bar.
const STAR_COLOR = "oklch(0.64 0.2 255)";
const STAR_TRACK = "var(--border)";

const ACCENT = "oklch(0.58 0.18 255)";

type Tone = "blue" | "violet";

// Static class fragments per accent tone — kept as literal strings so Tailwind's
// JIT picks them up. Drives the card border, badge, icons, and CTA per plan.
const TONE: Record<
  Tone,
  { text: string; softBg: string; border: string; shadow: string; badge: string; solid: string; outline: string }
> = {
  blue: {
    text: "text-[oklch(0.58_0.18_255)]",
    softBg: "bg-[oklch(0.58_0.18_255)]/8",
    border: "border-[oklch(0.58_0.18_255)]",
    shadow: "shadow-[0_18px_50px_-20px_rgba(37,64,235,0.45)]",
    badge: "border-[oklch(0.58_0.18_255)]/30",
    solid: "bg-[oklch(0.58_0.18_255)] text-white hover:bg-[oklch(0.54_0.18_255)]",
    outline:
      "border-[oklch(0.58_0.18_255)]/30 bg-transparent text-[oklch(0.58_0.18_255)] hover:bg-[oklch(0.58_0.18_255)]/8 hover:text-[oklch(0.58_0.18_255)]",
  },
  violet: {
    text: "text-[oklch(0.55_0.22_300)]",
    softBg: "bg-[oklch(0.55_0.22_300)]/8",
    border: "border-[oklch(0.55_0.22_300)]",
    shadow: "shadow-[0_18px_50px_-20px_rgba(124,58,237,0.45)]",
    badge: "border-[oklch(0.55_0.22_300)]/30",
    solid: "bg-[oklch(0.55_0.22_300)] text-white hover:bg-[oklch(0.5_0.22_300)]",
    outline:
      "border-[oklch(0.55_0.22_300)]/30 bg-transparent text-[oklch(0.55_0.22_300)] hover:bg-[oklch(0.55_0.22_300)]/8 hover:text-[oklch(0.55_0.22_300)]",
  },
};

interface Plan {
  name: string;
  icon: LucideIcon;
  audience: string;
  price: string;
  period?: string;
  blurb: string;
  features: string[];
  cta: string;
  to: string;
  tone?: Tone; // accent for icons + CTA (defaults to blue)
  badge?: { label: string; icon: LucideIcon }; // highlights the card with a border + ribbon
  featured?: boolean; // lifts the card on desktop
}

const PLANS: Plan[] = [
  {
    name: "Starter",
    icon: Building2,
    audience: "For brand owners",
    price: "$199",
    period: "/mo",
    blurb: "Perfect for in-house teams and single brands.",
    features: [
      "1 brand / 5 monitored marks",
      "Daily scans across 3 platforms",
      "Manual takedown workflow",
      "Email alerts",
    ],
    cta: "Start monitoring",
    to: "/dashboard",
  },
  {
    name: "Growth",
    icon: Users,
    audience: "For growing brand teams",
    price: "$499",
    period: "/mo",
    blurb: "Built for scaling brand teams with more coverage and faster takedowns.",
    features: [
      "Up to 5 brands / 50 marks",
      "Hourly scans, all platforms",
      "Automated DMCA + C&D templates",
      "Webhook + Slack alerts",
      "Evidence PDF export",
      "Faster takedowns with priority support",
    ],
    cta: "Start monitoring",
    to: "/dashboard",
    tone: "blue",
    badge: { label: "Most popular", icon: Star },
    featured: true,
  },
  {
    name: "Enterprise",
    icon: Scale,
    audience: "For law firms / IP counsel",
    price: "Custom",
    blurb: "Tailored for law firms and IP counsel managing complex enforcement.",
    features: [
      "Unlimited marks & scans",
      "Manage multiple clients and matters",
      "Dedicated success manager",
      "Custom integrations & APIs",
      "Contractual SLAs",
      "On-prem evidence retention",
    ],
    cta: "Book a demo",
    to: "/plans",
    tone: "violet",
    badge: { label: "Pro-grade", icon: Sparkles },
  },
];

const ASSURANCES: { icon: LucideIcon; label: string }[] = [
  { icon: DollarSign, label: "No setup fees" },
  { icon: CalendarDays, label: "Cancel anytime" },
  { icon: ShieldCheck, label: "Enterprise-grade security" },
];

/** Fires once when the element first scrolls into view. */
function useInView<T extends HTMLElement>(threshold = 0.2) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;
    const ob = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          ob.disconnect();
        }
      },
      { threshold },
    );
    ob.observe(el);
    return () => ob.disconnect();
  }, [inView, threshold]);
  return { ref, inView };
}

/** Three baseline-aligned bars standing in for the three tiers — neutral
 *  (Starter), blue (Growth), violet (Enterprise). The middle bar grows to full
 *  height on hover, hinting at the side-by-side comparison the link opens. */
function CompareGlyph() {
  return (
    <svg
      width="17"
      height="14"
      viewBox="0 0 17 14"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      <rect x="0" y="7" width="4" height="7" rx="1.25" className="fill-foreground/25" />
      <rect
        x="6.5"
        y="2"
        width="4"
        height="12"
        rx="1.25"
        className="origin-bottom fill-[oklch(0.58_0.18_255)] transition-transform duration-300 ease-out group-hover:scale-y-100 motion-reduce:transition-none"
        style={{ transformBox: "fill-box", transform: "scaleY(0.68)" }}
      />
      <rect x="13" y="4.5" width="4" height="9.5" rx="1.25" className="fill-[oklch(0.55_0.22_300)]" />
    </svg>
  );
}

function PlanCard({ plan, index, inView }: { plan: Plan; index: number; inView: boolean }) {
  const Icon = plan.icon;
  const t = TONE[plan.tone ?? "blue"];
  const highlighted = Boolean(plan.badge);
  const BadgeIcon = plan.badge?.icon;

  return (
    <div
      className={cn(
        "relative flex flex-col rounded-3xl border bg-card p-6 transition-all duration-700 ease-out motion-reduce:transition-none",
        highlighted
          ? cn(t.border, t.shadow)
          : "border-border shadow-[0_1px_3px_rgba(15,23,42,0.05)]",
        inView ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
      )}
      style={{ transitionDelay: `${index * 120}ms` }}
    >
      {plan.badge && BadgeIcon && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border bg-card px-4 py-1.5 text-xs font-semibold shadow-sm",
              t.badge,
              t.text,
            )}
          >
            <BadgeIcon className="h-3.5 w-3.5 fill-current" strokeWidth={0} />
            {plan.badge.label}
          </span>
        </div>
      )}

      <h3 className="font-display text-xl font-bold tracking-tight">{plan.name}</h3>

      <div
        className={cn(
          "mt-3 inline-flex w-fit items-center gap-2 rounded-lg px-2.5 py-1.5",
          t.softBg,
          t.text,
        )}
      >
        <Icon className="h-4 w-4 shrink-0" strokeWidth={2} />
        <span className="text-xs font-semibold text-foreground/80">{plan.audience}</span>
      </div>

      <div className="mt-4 flex items-baseline gap-1.5">
        <span className="font-display text-4xl font-bold tracking-tight">{plan.price}</span>
        {plan.period && (
          <span className="text-sm font-medium text-muted-foreground">{plan.period}</span>
        )}
      </div>

      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{plan.blurb}</p>

      <hr className="my-5 border-border" />

      <ul className="space-y-3">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-3 text-sm font-medium">
            <CheckCircle2 className={cn("mt-0.5 h-4 w-4 shrink-0", t.text)} strokeWidth={2.25} />
            {feature}
          </li>
        ))}
      </ul>

      <Button
        asChild
        variant={plan.featured ? "default" : "outline"}
        className={cn("mt-6 w-full", plan.featured ? t.solid : t.outline)}
      >
        <Link to={plan.to}>{plan.cta}</Link>
      </Button>
    </div>
  );
}

export function Pricing() {
  const { ref, inView } = useInView<HTMLElement>();

  return (
    <section
      ref={ref}
      id="pricing"
      className="relative scroll-mt-16 overflow-hidden border-b border-border py-16 md:py-20 lg:flex lg:h-screen lg:flex-col lg:justify-center lg:py-0"
    >
      <div className="relative mx-auto w-full max-w-[80rem] px-6 md:px-10 lg:px-12">
        {/* Header */}
        <div
          className={cn(
            "text-center transition-all duration-700 ease-out motion-reduce:transition-none",
            inView ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
          )}
        >
          <div
            className="text-xs font-semibold uppercase tracking-[0.18em]"
            style={{ color: ACCENT }}
          >
            Use cases &amp; pricing
          </div>
          <h2 className="mt-3 font-display text-4xl font-bold tracking-tight md:text-5xl lg:whitespace-nowrap">
            Plans built for brand teams and IP professionals
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
            Whether you&rsquo;re protecting your brand, scaling enforcement, or managing IP for
            clients, choose the plan that fits your team and enforcement needs.
          </p>
        </div>

        {/* Plans */}
        <div className="mx-auto mt-10 grid max-w-[380px] items-center gap-5 lg:max-w-none lg:grid-cols-3">
          {PLANS.map((plan, i) => (
            <PlanCard key={plan.name} plan={plan} index={i} inView={inView} />
          ))}
        </div>

        {/* Assurance bar — guarantees on the left, compare link capping the end.
            Wrapped in a star border so a comet traces its edges. */}
        <StarBorder
          color={STAR_COLOR}
          trackColor={STAR_TRACK}
          speed="6s"
          thickness={2}
          radius="calc(1rem + 2px)"
          streakHeight={120}
          className={cn(
            "mx-auto mt-8 max-w-[380px] transition-all duration-700 ease-out motion-reduce:transition-none lg:max-w-none",
            inView ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
          )}
          style={{ transitionDelay: "300ms" }}
        >
          <div className="flex flex-col gap-4 rounded-2xl bg-card px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:divide-x sm:divide-border">
              {ASSURANCES.map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-2.5 sm:px-4 sm:first:pl-1">
                  <Icon className="h-5 w-5 shrink-0" style={{ color: ACCENT }} strokeWidth={2} />
                  <span className="text-sm font-medium text-foreground/80">{label}</span>
                </div>
              ))}
            </div>

            <Link
              to="/plans"
              className="group inline-flex items-center gap-2.5 rounded-md border border-input bg-background px-5 py-2 text-sm font-semibold text-foreground/80 shadow-sm transition-colors hover:border-foreground/25 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <CompareGlyph />
              Compare all plans and features
              <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform duration-300 group-hover:translate-x-0.5 group-hover:text-foreground motion-reduce:transition-none" />
            </Link>
          </div>
        </StarBorder>
      </div>
    </section>
  );
}
