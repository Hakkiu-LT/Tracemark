import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Users,
  Scale,
  Rocket,
  CheckCircle2,
  Star,
  Sparkles,
  DollarSign,
  CalendarDays,
  ShieldCheck,
  Shield,
  Globe,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import { StarBorder } from "./star-border";
import { RequestPricingModal } from "./request-pricing-modal";

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
  to?: string;
  onClick?: () => void;
  tone?: Tone; // accent for icons + CTA (defaults to blue)
  badge?: { label: string; icon: LucideIcon }; // highlights the card with a border + ribbon
  featured?: boolean; // lifts the card on desktop
  starBorder?: boolean; // wraps card in purple glowing star border
}

const ASSURANCES = [
  { icon: Shield, label: "No setup fees" },
  { icon: Globe, label: "EU-based infrastructure" },
  { icon: Sparkles, label: "Cancel anytime" },
];

const FAQ_ITEMS = [
  {
    q: "Can I cancel anytime?",
    a: "Yes. All plans are monthly with no lock-in. Cancel from your billing settings and you won't be charged again.",
  },
  {
    q: "What counts as a takedown notice?",
    a: "One notice is one formal copyright or trademark infringement notice dispatched to a marketplace or registrar. Notice drafting and generation is unlimited on all plans.",
  },
  {
    q: "Is Amazon included?",
    a: "Yes. Amazon monitoring is active on all plans at no extra cost, alongside 11 other major marketplaces.",
  },
  {
    q: "What is the difference between Pro and Enterprise?",
    a: "Pro is self-serve with access to all 12 platforms and real-time scanning. Enterprise adds full custom scraping infrastructure, dedicated account specialists, and custom SSO/SAML integrations.",
  },
];

function PricingFAQ() {
  return (
    <div className="mx-auto mt-16 max-w-2xl">
      <h3 className="text-center text-lg font-semibold tracking-tight text-foreground">
        Frequently asked questions
      </h3>
      <Accordion type="single" collapsible className="mt-6 divide-y divide-border rounded-xl border border-border px-6 bg-card">
        {FAQ_ITEMS.map((item, i) => (
          <AccordionItem key={i} value={`faq-${i}`} className="border-none">
            <AccordionTrigger className="text-sm font-medium hover:no-underline py-4 text-foreground">
              {item.q}
            </AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground leading-relaxed pb-4">
              {item.a}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}

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

function PlanCardContent({ plan, index, inView }: { plan: Plan; index: number; inView: boolean }) {
  const Icon = plan.icon;
  const t = TONE[plan.tone ?? "blue"];
  const highlighted = Boolean(plan.badge);
  const BadgeIcon = plan.badge?.icon;

  return (
    <div
      className={cn(
        "relative flex h-full flex-col justify-between rounded-3xl border bg-card p-7 transition-all duration-700 ease-out motion-reduce:transition-none",
        highlighted
          ? cn(t.border, t.shadow)
          : "border-border shadow-[0_1px_3px_rgba(15,23,42,0.05)]",
        plan.featured && "ring-2 ring-[oklch(0.58_0.18_255)] scale-[1.02]",
        inView ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
      )}
      style={{ transitionDelay: `${index * 120}ms` }}
    >
      {plan.badge && BadgeIcon && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border bg-card px-4 py-1 text-xs font-semibold shadow-sm",
              t.badge,
              t.text,
            )}
          >
            <BadgeIcon className="h-3.5 w-3.5 fill-current" strokeWidth={0} />
            {plan.badge.label}
          </span>
        </div>
      )}

      <div>
        <h3 className="font-display text-2xl font-bold tracking-tight text-foreground">{plan.name}</h3>

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

        <div className="mt-5 flex items-baseline gap-1.5">
          <span className="font-display text-4xl font-extrabold tracking-tight text-foreground">{plan.price}</span>
          {plan.period && (
            <span className="text-sm font-medium text-muted-foreground">{plan.period}</span>
          )}
        </div>

        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{plan.blurb}</p>

        <hr className="my-6 border-border" />

        <ul className="space-y-3.5">
          {plan.features.map((feature) => (
            <li key={feature} className="flex items-start gap-3 text-sm font-medium text-foreground">
              <CheckCircle2 className={cn("mt-0.5 h-4 w-4 shrink-0", t.text)} strokeWidth={2.25} />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </div>

      {plan.onClick ? (
        <Button
          onClick={plan.onClick}
          variant={plan.featured ? "default" : "outline"}
          className={cn("mt-8 w-full h-11 text-sm font-semibold rounded-xl cursor-pointer", plan.featured ? t.solid : t.outline)}
        >
          {plan.cta}
        </Button>
      ) : (
        <Button
          asChild
          variant={plan.featured ? "default" : "outline"}
          className={cn("mt-8 w-full h-11 text-sm font-semibold rounded-xl cursor-pointer", plan.featured ? t.solid : t.outline)}
        >
          <Link to={plan.to ?? "/dashboard"}>{plan.cta}</Link>
        </Button>
      )}
    </div>
  );
}

function PlanCard({ plan, index, inView }: { plan: Plan; index: number; inView: boolean }) {
  if (plan.starBorder) {
    return (
      <StarBorder
        color="oklch(0.65 0.25 300)"
        trackColor="rgba(168, 85, 247, 0.25)"
        speed="5s"
        radius="1.5rem"
        className="h-full"
      >
        <PlanCardContent plan={plan} index={index} inView={inView} />
      </StarBorder>
    );
  }
  return <PlanCardContent plan={plan} index={index} inView={inView} />;
}

export function Pricing() {
  const { ref, inView } = useInView<HTMLElement>();
  const [modalTier, setModalTier] = useState<"professional" | "enterprise" | null>(null);

  const PLANS: Plan[] = [
    {
      name: "Growth",
      icon: Users,
      audience: "For growing brand teams",
      price: "$249",
      period: "/mo",
      blurb: "For scaling e-commerce and brand teams.",
      features: [
        "5 brands monitored",
        "All 12 platforms covered",
        "Daily automated AI scans",
        "Auto-generated takedown notices",
        "Priority email support",
      ],
      cta: "Start monitoring",
      to: "/dashboard",
      tone: "blue",
    },
    {
      name: "Pro",
      icon: Rocket,
      audience: "For established brands & IP teams",
      price: "$599",
      period: "/mo",
      blurb: "Real-time brand protection with domain tracking.",
      features: [
        "20 brands monitored",
        "All 12 platforms + Domain tracking",
        "Real-time AI monitoring & alerts",
        "Auto-generated DMCA & C&D docs",
        "Dedicated account manager",
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
      audience: "For enterprise & law firms",
      price: "Custom",
      blurb: "Managed brand enforcement with custom SLA.",
      features: [
        "Unlimited brands & monitoring",
        "Court-ready evidence & legal dossiers",
        "Dedicated crawling infrastructure",
        "Custom SSO/SAML & full API access",
        "Dedicated IP specialist & 99.9% SLA",
      ],
      cta: "Request Pricing",
      onClick: () => setModalTier("enterprise"),
      tone: "violet",
      badge: { label: "Enterprise SLA", icon: Sparkles },
      starBorder: true,
    },
  ];

  return (
    <section
      ref={ref}
      id="pricing"
      className="relative scroll-mt-16 overflow-hidden border-b border-border/60 bg-background py-20 md:py-24"
    >
      <div className="relative mx-auto w-full max-w-6xl px-6 lg:px-8">
        {/* Header */}
        <div
          className={cn(
            "text-center transition-all duration-700 ease-out motion-reduce:transition-none",
            inView ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
          )}
        >
          <p className="font-mono text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            TRANSPARENT PLANS
          </p>
          <h2 className="mt-3 font-display text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
            Plans built for brand teams and IP professionals
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
            Whether you&rsquo;re scaling brand protection or managing enterprise enforcement, choose the plan built for your needs.
          </p>
        </div>

        {/* 3 Plans Grid (Growth, Pro - Most Popular, Enterprise with Purple StarBorder) */}
        <div className="mx-auto mt-14 grid max-w-5xl items-stretch gap-8 sm:grid-cols-1 md:grid-cols-3">
          {PLANS.map((plan, i) => (
            <PlanCard key={plan.name} plan={plan} index={i} inView={inView} />
          ))}
        </div>

        {/* Assurance bar */}
        <div className="mt-16 flex flex-wrap items-center justify-center gap-x-10 gap-y-3">
          {ASSURANCES.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-2 text-sm text-muted-foreground">
              <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
              {label}
            </div>
          ))}
        </div>

        {/* FAQ Section */}
        <PricingFAQ />
      </div>

      <RequestPricingModal
        open={modalTier !== null}
        onOpenChange={(open) => {
          if (!open) setModalTier(null);
        }}
        tier={modalTier ?? "enterprise"}
      />
    </section>
  );
}
