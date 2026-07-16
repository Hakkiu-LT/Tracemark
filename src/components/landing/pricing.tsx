import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Building2,
  Users,
  Scale,
  Rocket,
  Briefcase,
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
  {
    text: string;
    softBg: string;
    border: string;
    shadow: string;
    badge: string;
    solid: string;
    outline: string;
  }
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
    price: "$99",
    period: "/mo",
    blurb: "For founders protecting a single brand.",
    features: [
      "1 brand",
      "3 platforms",
      "Weekly scans",
      "Assisted takedown notices",
      "Email support",
    ],
    cta: "Start monitoring",
    to: "/dashboard",
  },
  {
    name: "Growth",
    icon: Users,
    audience: "For growing brand teams",
    price: "$249",
    period: "/mo",
    blurb: "For scaling e-commerce and SaaS teams.",
    features: [
      "5 brands",
      "All 12 platforms",
      "Daily scans",
      "Auto takedown generation",
      "Priority support",
    ],
    cta: "Start monitoring",
    to: "/dashboard",
    tone: "blue",
    badge: { label: "Most popular", icon: Star },
    featured: true,
  },
  {
    name: "Pro",
    icon: Rocket,
    audience: "For established brands",
    price: "$599",
    period: "/mo",
    blurb: "Real-time protection with domain tracking.",
    features: [
      "20 brands",
      "All platforms + domain tracking",
      "Real-time monitoring",
      "Auto-generated DMCA & C&D docs",
      "Dedicated account manager",
    ],
    cta: "Start monitoring",
    to: "/dashboard",
  },
  {
    name: "Agency",
    icon: Briefcase,
    audience: "For agencies & law firms",
    price: "$1,499",
    period: "/mo",
    blurb: "White-label multi-client workspace.",
    features: [
      "White-label reports",
      "Full API access",
      "Multi-client dashboard",
      "SLA + dedicated support",
    ],
    cta: "Start monitoring",
    to: "/dashboard",
    tone: "violet",
    badge: { label: "Best for agencies", icon: Sparkles },
  },
  {
    name: "Enterprise",
    icon: Scale,
    audience: "For large corporations",
    price: "Custom",
    blurb: "Managed service — we do the work for you.",
    features: [
      "Managed takedown service",
      "Court-ready evidence & legal integration",
      "Dedicated scraping infrastructure",
      "Custom integrations (SSO/SAML)",
      "99.9% SLA · SOC 2 · GDPR",
    ],
    cta: "Book a demo",
    to: "/plans",
    tone: "violet",
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
      <rect
        x="13"
        y="4.5"
        width="4"
        height="9.5"
        rx="1.25"
        className="fill-[oklch(0.55_0.22_300)]"
      />
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
      className="relative scroll-mt-16 overflow-hidden border-b border-border py-16 md:py-20 lg:py-24"
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
        <div className="mx-auto mt-10 grid max-w-[380px] items-center gap-5 sm:max-w-none sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {PLANS.map((plan, i) => (
            <PlanCard key={plan.name} plan={plan} index={i} inView={inView} />
          ))}
        </div>
      </div>
    </section>
  );
}
