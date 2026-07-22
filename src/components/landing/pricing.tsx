import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  CheckCircle2,
  Shield,
  Sparkles,
  Globe,
  Star,
  ChevronRight,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { RequestPricingModal } from "./request-pricing-modal";

// ── Marketplace list ─────────────────────────────────────────────────────────

const MARKETPLACES: { key: string; label: string }[] = [
  { key: "amazon",    label: "Amazon" },
  { key: "ebay",      label: "eBay" },
  { key: "alibaba",   label: "Alibaba" },
  { key: "aliexpress",label: "AliExpress" },
  { key: "etsy",      label: "Etsy" },
  { key: "wish",      label: "Wish" },
  { key: "temu",      label: "Temu" },
  { key: "shopify",   label: "Shopify stores" },
  { key: "facebook",  label: "Facebook" },
  { key: "instagram", label: "Instagram" },
  { key: "tiktok",    label: "TikTok Shop" },
  { key: "taobao",    label: "Taobao" },
];

// ── Pricing constants ─────────────────────────────────────────────────────────

const BASE_PRICE = 849;

const TM_ADD_ON: Record<number, number> = {
  1: 149,
  2: 269,
  3: 349,
  4: 469,
  5: 579,
};

const MARKETPLACE_ADD_ON_PRICE = 40; // per extra marketplace beyond Amazon

const DOMAIN_PROTECTION_PRICE = 649;

// ── Configurator ──────────────────────────────────────────────────────────────

function PricingConfigurator() {
  const [tmCount, setTmCount] = useState(1);
  // Amazon is always included. selectedExtra = set of keys beyond amazon.
  const [extraMarkets, setExtraMarkets] = useState<Set<string>>(new Set());
  const [domainProtection, setDomainProtection] = useState(false);

  function toggleMarket(key: string) {
    setExtraMarkets((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const tmAddon = TM_ADD_ON[tmCount] ?? 0;
  const marketplaceAddon = extraMarkets.size * MARKETPLACE_ADD_ON_PRICE;
  const domainAddon = domainProtection ? DOMAIN_PROTECTION_PRICE : 0;
  const total = BASE_PRICE + tmAddon + marketplaceAddon + domainAddon;

  return (
    <div className="flex flex-col rounded-3xl border border-[oklch(0.58_0.18_255)] bg-card shadow-[0_18px_50px_-20px_rgba(37,64,235,0.45)] overflow-hidden">
      {/* Header */}
      <div className="px-7 pt-7 pb-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-xl font-bold tracking-tight">Self-Serve</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Start protecting today. No sales call.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[oklch(0.58_0.18_255)]/30 bg-card px-3.5 py-1.5 text-xs font-semibold text-[oklch(0.58_0.18_255)] shadow-sm">
            <Star className="h-3.5 w-3.5 fill-current" strokeWidth={0} />
            Most popular
          </span>
        </div>

        {/* Live price */}
        <div className="mt-5 flex items-baseline gap-1.5">
          <span className="font-display text-5xl font-bold tracking-tight">
            €{total.toLocaleString("en-EU")}
          </span>
          <span className="text-sm font-medium text-muted-foreground">/mo</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Flat monthly fee · unlimited detections · unlimited takedowns
        </p>
      </div>

      <hr className="border-border" />

      {/* Configurator body */}
      <div className="px-7 py-6 space-y-7">

        {/* Step 1 — TM count */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold">
              <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[oklch(0.58_0.18_255)] text-[10px] font-bold text-white">1</span>
              Trademark count
            </p>
            <span className="text-sm font-semibold text-[oklch(0.58_0.18_255)]">
              +€{tmAddon}/mo
            </span>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => setTmCount(n)}
                className={cn(
                  "rounded-xl border py-2.5 text-sm font-semibold transition-colors",
                  tmCount === n
                    ? "border-[oklch(0.58_0.18_255)] bg-[oklch(0.58_0.18_255)]/10 text-[oklch(0.58_0.18_255)]"
                    : "border-border bg-background hover:border-[oklch(0.58_0.18_255)]/40 hover:bg-[oklch(0.58_0.18_255)]/5",
                )}
              >
                {n}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Trademarks / brand names to monitor</p>
        </div>

        {/* Step 2 — Marketplaces */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold">
              <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[oklch(0.58_0.18_255)] text-[10px] font-bold text-white">2</span>
              Marketplaces
            </p>
            {extraMarkets.size > 0 && (
              <span className="text-sm font-semibold text-[oklch(0.58_0.18_255)]">
                +€{marketplaceAddon}/mo
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {MARKETPLACES.map(({ key, label }) => {
              const isBase = key === "amazon";
              const checked = isBase || extraMarkets.has(key);
              return (
                <button
                  key={key}
                  disabled={isBase}
                  onClick={() => !isBase && toggleMarket(key)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors text-left",
                    checked && !isBase
                      ? "border-[oklch(0.58_0.18_255)] bg-[oklch(0.58_0.18_255)]/10 text-[oklch(0.58_0.18_255)]"
                      : isBase
                        ? "border-border bg-muted/30 text-muted-foreground cursor-default"
                        : "border-border bg-background hover:border-[oklch(0.58_0.18_255)]/40 hover:bg-[oklch(0.58_0.18_255)]/5",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                      checked
                        ? "border-[oklch(0.58_0.18_255)] bg-[oklch(0.58_0.18_255)]"
                        : "border-border",
                    )}
                  >
                    {checked && (
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                        <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                  {label}
                  {isBase && (
                    <span className="ml-auto text-[10px] text-muted-foreground">included</span>
                  )}
                  {!isBase && !checked && (
                    <span className="ml-auto text-[10px] text-muted-foreground">+€40</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Step 3 — Domain protection */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold">
              <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[oklch(0.58_0.18_255)] text-[10px] font-bold text-white">3</span>
              Domain &amp; website protection
            </p>
            {domainProtection && (
              <span className="text-sm font-semibold text-[oklch(0.58_0.18_255)]">
                +€{DOMAIN_PROTECTION_PRICE}/mo
              </span>
            )}
          </div>
          <button
            onClick={() => setDomainProtection((v) => !v)}
            className={cn(
              "flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-colors",
              domainProtection
                ? "border-[oklch(0.58_0.18_255)] bg-[oklch(0.58_0.18_255)]/8"
                : "border-border hover:border-[oklch(0.58_0.18_255)]/40",
            )}
          >
            <span
              className={cn(
                "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                domainProtection
                  ? "border-[oklch(0.58_0.18_255)] bg-[oklch(0.58_0.18_255)]"
                  : "border-muted-foreground/40",
              )}
            >
              {domainProtection && (
                <span className="h-2.5 w-2.5 rounded-full bg-white" />
              )}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">Add domain &amp; website monitoring</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                WHOIS tracking · phishing domains · typosquat detection · lookalike sites
              </p>
            </div>
            <span className="shrink-0 text-sm font-semibold text-muted-foreground">
              +€{DOMAIN_PROTECTION_PRICE}/mo
            </span>
          </button>
        </div>
      </div>

      {/* What's included */}
      <hr className="border-border" />
      <div className="px-7 py-5">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Everything included
        </p>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {[
            "Unlimited detections",
            "Unlimited takedown notices",
            "AI confidence scoring",
            "Auto takedown documents",
            "Branded PDF reports",
            "Live enforcement dashboard",
            "Unlimited team members",
            "Email support",
          ].map((f) => (
            <li key={f} className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-[oklch(0.58_0.18_255)]" strokeWidth={2.25} />
              {f}
            </li>
          ))}
        </ul>
      </div>

      {/* CTA */}
      <div className="px-7 pb-7">
        <p className="mb-3 text-xs text-muted-foreground">
          Not charged per detection. Not charged per takedown. Your bill is flat.
        </p>
        <Button
          asChild
          className="w-full bg-[oklch(0.58_0.18_255)] text-white hover:bg-[oklch(0.54_0.18_255)]"
        >
          <Link to="/dashboard">
            Start monitoring — €{total.toLocaleString("en-EU")}/mo
            <ChevronRight className="ml-1.5 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}

// ── Contact-sales card ────────────────────────────────────────────────────────

interface SalesCardProps {
  name: string;
  tagline: string;
  indicativePrice: string;
  features: string[];
  tier: "professional" | "enterprise";
  onRequest: () => void;
}

function SalesCard({ name, tagline, indicativePrice, features, onRequest }: SalesCardProps) {
  return (
    <div className="flex flex-col rounded-3xl border border-border bg-card p-7 shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
      <h3 className="font-display text-xl font-bold tracking-tight">{name}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{tagline}</p>

      <div className="mt-5 flex items-baseline gap-1">
        <span className="font-display text-3xl font-bold tracking-tight">{indicativePrice}</span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">Indicative · final price on request</p>

      <hr className="my-5 border-border" />

      <ul className="flex-1 space-y-2.5">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2.5 text-sm">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[oklch(0.55_0.22_300)]" strokeWidth={2.25} />
            {f}
          </li>
        ))}
      </ul>

      <Button
        onClick={onRequest}
        variant="outline"
        className="mt-7 w-full border-[oklch(0.55_0.22_300)]/30 text-[oklch(0.55_0.22_300)] hover:bg-[oklch(0.55_0.22_300)]/8 hover:text-[oklch(0.55_0.22_300)]"
      >
        Request pricing
      </Button>
    </div>
  );
}

// ── Assurance bar ─────────────────────────────────────────────────────────────

const ASSURANCES = [
  { icon: Shield,   label: "No setup fees" },
  { icon: Globe,    label: "EU-based infrastructure" },
  { icon: Sparkles, label: "Cancel anytime" },
];

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

        {/* Cards grid */}
        <div className="mx-auto mt-12 grid max-w-[380px] items-start gap-6 sm:max-w-none sm:grid-cols-2 xl:grid-cols-3">
          <PricingConfigurator />

          <SalesCard
            tier="professional"
            name="Professional"
            tagline="For brands with complex enforcement needs"
            indicativePrice="€3,500–6,000/mo"
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
            indicativePrice="€7,000+/mo"
            features={[
              "White-label / law-firm mode",
              "Multi-client workspace",
              "SSO / SAML authentication",
              "Custom integrations",
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
      </div>

      <RequestPricingModal
        open={modalTier !== null}
        onOpenChange={(open) => { if (!open) setModalTier(null); }}
        tier={modalTier ?? "professional"}
      />
    </section>
  );
}
