import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  CheckCircle2,
  Shield,
  Sparkles,
  Globe,
  Star,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import { RequestPricingModal } from "./request-pricing-modal";

// ── Self-Serve static card ────────────────────────────────────────────────────

const SELF_SERVE_FEATURES = [
  "1–5 trademarks to monitor",
  "All 12 marketplace platforms",
  "Unlimited detections & takedowns",
  "AI confidence scoring",
  "Auto takedown documents",
  "Branded PDF reports",
  "Live enforcement dashboard",
  "Email support",
];

function SelfServeCard() {
  const navigate = useNavigate();

  return (
    <div className="flex h-full flex-col rounded-3xl border border-[oklch(0.58_0.18_255)] bg-card shadow-[0_18px_50px_-20px_rgba(37,64,235,0.32)] overflow-hidden">
      {/* Header */}
      <div className="px-7 pt-7 pb-5">
        <h3 className="font-display text-xl font-bold tracking-tight">Self-Serve</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure instantly. No sales call needed.
        </p>

        <div className="mt-5">
          <span className="text-2xl font-bold text-[oklch(0.58_0.18_255)]">
            Configurable pricing
          </span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Set your plan · instant checkout
        </p>
      </div>

      <hr className="border-border" />

      {/* Features */}
      <div className="flex-1 px-7 py-5">
        <ul className="space-y-2.5">
          {SELF_SERVE_FEATURES.map((f) => (
            <li key={f} className="flex items-start gap-2.5 text-sm">
              <CheckCircle2
                className="mt-0.5 h-4 w-4 shrink-0 text-[oklch(0.58_0.18_255)]"
                strokeWidth={2.25}
              />
              {f}
            </li>
          ))}
        </ul>
      </div>

      {/* CTA */}
      <div className="px-7 pb-7 pt-2">
        <Button
          onClick={() => navigate({ to: "/configure" })}
          size="lg"
          className="w-full font-semibold bg-[oklch(0.58_0.18_255)] text-white hover:bg-[oklch(0.54_0.18_255)]"
        >
          Buy Now
          <ChevronRight className="ml-1.5 h-4 w-4" />
        </Button>
        <p className="mt-2.5 text-center text-xs text-muted-foreground">
          Instant access · cancel anytime
        </p>
      </div>
    </div>
  );
}

// ── Contact-sales card ────────────────────────────────────────────────────────

interface SalesCardProps {
  name: string;
  tagline: string;
  features: string[];
  tier: "professional" | "enterprise";
  onRequest: () => void;
  mostPopular?: boolean;
}

function SalesCard({ name, tagline, features, tier, onRequest, mostPopular }: SalesCardProps) {
  const isPro = tier === "professional";

  return (
    <div
      className={cn(
        "flex h-full flex-col rounded-3xl border bg-card overflow-hidden",
        isPro
          ? "border-[oklch(0.55_0.22_300)] shadow-[0_18px_50px_-20px_rgba(130,60,220,0.28)]"
          : "border-border shadow-[0_1px_4px_rgba(15,23,42,0.06)]",
      )}
    >
      {/* Header */}
      <div className="px-7 pt-7 pb-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-xl font-bold tracking-tight">{name}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{tagline}</p>
          </div>
          {mostPopular && (
            <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-[oklch(0.55_0.22_300)]/40 bg-[oklch(0.55_0.22_300)]/8 px-3 py-1.5 text-xs font-semibold text-[oklch(0.55_0.22_300)]">
              <Star className="h-3 w-3 fill-current" strokeWidth={0} />
              Most popular
            </span>
          )}
        </div>

        <div className="mt-5">
          <span
            className={cn(
              "text-2xl font-bold",
              isPro ? "text-[oklch(0.55_0.22_300)]" : "text-muted-foreground",
            )}
          >
            Custom pricing
          </span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Free consultation · tailored proposal
        </p>
      </div>

      <hr className="border-border" />

      {/* Features */}
      <div className="flex-1 px-7 py-5">
        <ul className="space-y-2.5">
          {features.map((f) => (
            <li key={f} className="flex items-start gap-2.5 text-sm">
              <CheckCircle2
                className={cn(
                  "mt-0.5 h-4 w-4 shrink-0",
                  isPro ? "text-[oklch(0.55_0.22_300)]" : "text-[oklch(0.50_0.10_255)]",
                )}
                strokeWidth={2.25}
              />
              {f}
            </li>
          ))}
        </ul>
      </div>

      {/* CTA */}
      <div className="px-7 pb-7 pt-2">
        <Button
          onClick={onRequest}
          size="lg"
          className={cn(
            "w-full font-semibold text-white",
            isPro
              ? "bg-[oklch(0.55_0.22_300)] hover:bg-[oklch(0.50_0.22_300)]"
              : "bg-[oklch(0.38_0.07_255)] hover:bg-[oklch(0.33_0.07_255)]",
          )}
        >
          Request Pricing
          <ChevronRight className="ml-1.5 h-4 w-4" />
        </Button>
        <p className="mt-2.5 text-center text-xs text-muted-foreground">
          Response within 1 business day
        </p>
      </div>
    </div>
  );
}

// ── Assurance bar ─────────────────────────────────────────────────────────────

const ASSURANCES = [
  { icon: Shield,   label: "No setup fees" },
  { icon: Globe,    label: "EU-based infrastructure" },
  { icon: Sparkles, label: "Cancel anytime" },
];

// ── FAQ ───────────────────────────────────────────────────────────────────────

const FAQ_ITEMS = [
  {
    q: "Can I cancel anytime?",
    a: "Yes. All plans are monthly with no lock-in. Cancel from your billing settings and you won't be charged again.",
  },
  {
    q: "What counts as a takedown?",
    a: "One takedown is one enforcement notice sent to a platform or registrar on your behalf — DMCA, platform abuse report, or ICANN complaint. You're never charged per takedown; they're unlimited on all plans.",
  },
  {
    q: "Is Amazon always included?",
    a: "Yes. Amazon is included in every Self-Serve plan at no extra cost. Additional marketplaces (eBay, AliExpress, Etsy, TikTok Shop, and 7 others) are available as add-ons.",
  },
  {
    q: "What's the difference between Self-Serve and Professional?",
    a: "Self-Serve covers up to 5 trademarks with daily monitoring, automated takedown documents, and email support. Professional adds unlimited brands, real-time 15-minute monitoring, a dedicated customer success manager, managed takedown service, and full API access.",
  },
  {
    q: "Do you offer annual billing?",
    a: "Annual billing is coming soon. Monthly billing is available today with no minimum commitment.",
  },
];

function PricingFAQ() {
  return (
    <div className="mx-auto mt-16 max-w-2xl">
      <h3 className="text-center text-lg font-semibold tracking-tight">
        Frequently asked questions
      </h3>
      <Accordion type="single" collapsible className="mt-6 divide-y divide-border rounded-xl border border-border px-6">
        {FAQ_ITEMS.map((item, i) => (
          <AccordionItem key={i} value={`faq-${i}`} className="border-none">
            <AccordionTrigger className="text-sm font-medium hover:no-underline py-4">
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

// ── Main export ───────────────────────────────────────────────────────────────

export function Pricing() {
  const [modalTier, setModalTier] = useState<"professional" | "enterprise" | null>(null);

  return (
    <section
      id="pricing"
      className="relative scroll-mt-16 overflow-hidden border-b border-border py-16 md:py-20 lg:py-24"
    >
      <div className="relative mx-auto w-full max-w-[82rem] px-6 md:px-10 lg:px-12">

        {/* Header */}
        <div className="text-center">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[oklch(0.58_0.18_255)]">
            Pricing
          </div>
          <h2 className="mt-3 font-display text-4xl font-bold tracking-tight md:text-5xl">
            Flat pricing. No per-takedown fees.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
            Configure your plan below — marketplaces, brand count, domain protection. One flat monthly
            bill regardless of how many counterfeits we find or remove.
          </p>
        </div>

        {/* Cards grid — items-stretch makes all cards the same height */}
        <div className="mx-auto mt-12 grid max-w-[380px] items-stretch gap-6 sm:max-w-none sm:grid-cols-2 xl:grid-cols-3">
          <SelfServeCard />

          <SalesCard
            tier="professional"
            name="Professional"
            tagline="For brands with complex enforcement needs"
            mostPopular
            features={[
              "Unlimited brands",
              "Real-time monitoring (15-min refresh)",
              "Domain & website protection included",
              "Managed takedown service",
              "Dedicated customer success manager",
              "Full API access & webhooks",
              "Priority support with 4h SLA",
            ]}
            onRequest={() => setModalTier("professional")}
          />

          <SalesCard
            tier="enterprise"
            name="Enterprise"
            tagline="For law firms, agencies & global brands"
            features={[
              "White-label / law-firm mode",
              "Multi-client workspace",
              "SSO / SAML authentication",
              "Custom integrations (Salesforce, SAP)",
              "EU data residency",
              "99.9% uptime SLA",
              "Court-ready evidence packaging",
            ]}
            onRequest={() => setModalTier("enterprise")}
          />
        </div>

        {/* Assurance bar */}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-x-10 gap-y-3">
          {ASSURANCES.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-2 text-sm text-muted-foreground">
              <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
              {label}
            </div>
          ))}
        </div>

        <PricingFAQ />
      </div>

      <RequestPricingModal
        open={modalTier !== null}
        onOpenChange={(open) => { if (!open) setModalTier(null); }}
        tier={modalTier ?? "professional"}
      />
    </section>
  );
}
