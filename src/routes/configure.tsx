import { useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { HakkiuLogo } from "@/components/hakkiu-logo";

// ── Pricing constants (mirror billing.ts) ────────────────────────────────────
const BASE_PRICE = 849;
const TM_ADD_ON: Record<number, number> = { 1: 149, 2: 269, 3: 349, 4: 469, 5: 579 };
const MARKETPLACE_ADD_ON_PRICE = 40;
const DOMAIN_PROTECTION_PRICE = 649;

const MARKETPLACES: { key: string; label: string }[] = [
  { key: "amazon",     label: "Amazon" },
  { key: "ebay",       label: "eBay" },
  { key: "alibaba",    label: "Alibaba" },
  { key: "aliexpress", label: "AliExpress" },
  { key: "etsy",       label: "Etsy" },
  { key: "wish",       label: "Wish" },
  { key: "temu",       label: "Temu" },
  { key: "shopify",    label: "Shopify" },
  { key: "facebook",   label: "Facebook" },
  { key: "instagram",  label: "Instagram" },
  { key: "tiktok",     label: "TikTok Shop" },
  { key: "taobao",     label: "Taobao" },
];

const BLUE = "oklch(0.58_0.18_255)";

export const Route = createFileRoute("/configure")({
  head: () => ({
    meta: [
      { title: "Configure Your Plan — HAKKIU" },
      { name: "description", content: "Build your custom trademark monitoring plan." },
    ],
  }),
  component: ConfigurePage,
});

function ConfigurePage() {
  const navigate = useNavigate();
  const [tmCount, setTmCount] = useState(1);
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

  const EXTRA_MARKETS = MARKETPLACES.filter((m) => m.key !== "amazon");
  const allSelected = EXTRA_MARKETS.every((m) => extraMarkets.has(m.key));

  function toggleAll() {
    if (allSelected) {
      setExtraMarkets(new Set());
    } else {
      setExtraMarkets(new Set(EXTRA_MARKETS.map((m) => m.key)));
    }
  }

  function handleCheckout() {
    navigate({
      to: "/review",
      search: {
        plan: "self_serve",
        interval: "month",
        tm: tmCount,
        marketplace: extraMarkets.size,
        domain: domainProtection ? 1 : 0,
        markets: Array.from(extraMarkets).join(","),
      },
    });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <Button asChild variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
            <Link to="/plans">
              <ArrowLeft className="h-4 w-4" />
              Back to plans
            </Link>
          </Button>
          <HakkiuLogo className="h-7 text-foreground" />
          <div className="w-28" />
        </div>
      </header>

      {/* Content */}
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-10 text-center">
          <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
            Configure your plan
          </h1>
          <p className="mt-3 text-muted-foreground">
            Select your coverage — pay only for what you need. Flat monthly bill, no per-action fees.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
          {/* Left: configurator */}
          <div className="space-y-8">
            {/* Step 1 — TM count */}
            <section className="rounded-2xl border border-border bg-card p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2.5 text-base font-semibold">
                  <StepBadge n={1} />
                  Trademarks to monitor
                </h2>
                <span className="text-sm font-semibold" style={{ color: BLUE }}>
                  +€{tmAddon}/mo
                </span>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => setTmCount(n)}
                    className={cn(
                      "rounded-xl border py-3 text-sm font-semibold transition-colors",
                      tmCount === n
                        ? "border-[oklch(0.58_0.18_255)] bg-[oklch(0.58_0.18_255)]/10 text-[oklch(0.58_0.18_255)]"
                        : "border-border bg-background hover:border-[oklch(0.58_0.18_255)]/40",
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <p className="mt-2.5 text-xs text-muted-foreground">
                Brand names / trademark registrations to monitor across all platforms
              </p>
            </section>

            {/* Step 2 — Marketplaces */}
            <section className="rounded-2xl border border-border bg-card p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2.5 text-base font-semibold">
                  <StepBadge n={2} />
                  Marketplaces &amp; social platforms
                </h2>
                <div className="flex items-center gap-3">
                  {extraMarkets.size > 0 && (
                    <span className="text-sm font-semibold" style={{ color: BLUE }}>
                      +€{marketplaceAddon}/mo
                    </span>
                  )}
                  <button
                    onClick={toggleAll}
                    className="text-xs font-medium text-[oklch(0.58_0.18_255)] hover:underline"
                  >
                    {allSelected ? "Deselect all" : "Select all"}
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {MARKETPLACES.map(({ key, label }) => {
                  const isBase = key === "amazon";
                  const checked = isBase || extraMarkets.has(key);
                  return (
                    <button
                      key={key}
                      disabled={isBase}
                      onClick={() => !isBase && toggleMarket(key)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                        checked && !isBase
                          ? "border-[oklch(0.58_0.18_255)] bg-[oklch(0.58_0.18_255)]/10 text-[oklch(0.58_0.18_255)]"
                          : isBase
                            ? "border-[oklch(0.58_0.18_255)]/30 bg-[oklch(0.58_0.18_255)]/5 text-[oklch(0.58_0.18_255)] cursor-default"
                            : "border-border bg-background hover:border-[oklch(0.58_0.18_255)]/40",
                      )}
                    >
                      {label}
                      {isBase && <span className="text-xs opacity-60">✓</span>}
                      {!isBase && !checked && (
                        <span className="text-xs text-muted-foreground">+€40</span>
                      )}
                    </button>
                  );
                })}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Amazon is always included. Each additional platform is +€40/mo.
              </p>
            </section>

            {/* Step 3 — Domain protection */}
            <section className="rounded-2xl border border-border bg-card p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2.5 text-base font-semibold">
                  <StepBadge n={3} />
                  Domain &amp; website protection
                </h2>
                {domainProtection && (
                  <span className="text-sm font-semibold" style={{ color: BLUE }}>
                    +€{DOMAIN_PROTECTION_PRICE}/mo
                  </span>
                )}
              </div>
              <button
                onClick={() => setDomainProtection((v) => !v)}
                className={cn(
                  "flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-colors",
                  domainProtection
                    ? "border-[oklch(0.58_0.18_255)] bg-[oklch(0.58_0.18_255)]/6"
                    : "border-border hover:border-[oklch(0.58_0.18_255)]/40",
                )}
              >
                <span
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                    domainProtection
                      ? "border-[oklch(0.58_0.18_255)] bg-[oklch(0.58_0.18_255)]"
                      : "border-muted-foreground/40",
                  )}
                >
                  {domainProtection && <span className="h-2.5 w-2.5 rounded-full bg-white" />}
                </span>
                <div className="flex-1">
                  <p className="font-medium">WHOIS monitoring · phishing detection · typosquatting</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    Monitor lookalike domains and fake websites impersonating your brand
                  </p>
                </div>
                <span className="shrink-0 text-sm font-medium text-muted-foreground">
                  +€{DOMAIN_PROTECTION_PRICE}/mo
                </span>
              </button>
            </section>
          </div>

          {/* Right: order summary (sticky) */}
          <div>
            <div className="sticky top-24 rounded-2xl border border-[oklch(0.58_0.18_255)] bg-card p-6 shadow-[0_8px_30px_-8px_rgba(37,64,235,0.25)]">
              <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                Your plan summary
              </p>

              <div className="space-y-2.5 text-sm">
                <SummaryRow label="Base plan" value={`€${BASE_PRICE}`} />
                <SummaryRow label={`${tmCount} trademark${tmCount > 1 ? "s" : ""}`} value={`+€${tmAddon}`} />
                {extraMarkets.size > 0 && (
                  <SummaryRow
                    label={`${extraMarkets.size} extra platform${extraMarkets.size > 1 ? "s" : ""}`}
                    value={`+€${marketplaceAddon}`}
                  />
                )}
                {domainProtection && (
                  <SummaryRow label="Domain protection" value={`+€${DOMAIN_PROTECTION_PRICE}`} />
                )}
              </div>

              <div className="mt-4 border-t border-border pt-4">
                <div className="flex items-baseline justify-between">
                  <span className="font-semibold">Total</span>
                  <span className="font-display text-3xl font-bold text-[oklch(0.58_0.18_255)]">
                    €{total.toLocaleString("en-EU")}
                    <span className="text-sm font-normal text-muted-foreground">/mo</span>
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Flat monthly fee · cancel anytime
                </p>
              </div>

              <Button
                onClick={handleCheckout}
                size="lg"
                className="mt-6 w-full font-semibold bg-[oklch(0.58_0.18_255)] text-white hover:bg-[oklch(0.54_0.18_255)]"
              >
                Review &amp; pay
                <ChevronRight className="ml-1.5 h-4 w-4" />
              </Button>

              <p className="mt-3 text-center text-xs text-muted-foreground">
                Not charged per detection or takedown
              </p>

              <hr className="my-4 border-border" />

              <ul className="space-y-2">
                {[
                  "Unlimited detections",
                  "Unlimited takedowns",
                  "AI confidence scoring",
                  "Auto takedown documents",
                  "Branded PDF reports",
                  "Unlimited team members",
                ].map((f) => (
                  <li key={f} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[oklch(0.58_0.18_255)]" strokeWidth={2.5} />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border mt-16">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-6 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} HAKKIU · Brand protection, automated.</span>
          <div className="flex items-center gap-5">
            <Link to="/auth/sign-in" className="hover:text-foreground transition-colors">Login</Link>
            <span className="hover:text-foreground transition-colors cursor-pointer">Privacy Policy</span>
            <span className="hover:text-foreground transition-colors cursor-pointer">Terms</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function StepBadge({ n }: { n: number }) {
  return (
    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[oklch(0.58_0.18_255)] text-xs font-bold text-white">
      {n}
    </span>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}
