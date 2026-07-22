import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { z } from "zod";
import { ArrowLeft, CheckCircle2, ChevronRight, ShoppingBag, Globe, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HakkiuLogo } from "@/components/hakkiu-logo";
import { cn } from "@/lib/utils";

const BASE_PRICE = 849;
const TM_ADD_ON: Record<number, number> = { 1: 149, 2: 269, 3: 349, 4: 469, 5: 579 };
const MARKETPLACE_PRICE = 40;
const DOMAIN_PRICE = 649;

const MARKETPLACE_LABELS: Record<string, string> = {
  amazon: "Amazon",
  ebay: "eBay",
  alibaba: "Alibaba",
  aliexpress: "AliExpress",
  etsy: "Etsy",
  wish: "Wish",
  temu: "Temu",
  shopify: "Shopify",
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok Shop",
  taobao: "Taobao",
};

const reviewSearchSchema = z.object({
  plan: z.string().catch("self_serve"),
  interval: z.enum(["month", "year"]).catch("month"),
  tm: z.coerce.number().min(1).max(5).catch(1),
  marketplace: z.coerce.number().min(0).max(11).catch(0),
  domain: z.coerce.number().min(0).max(1).catch(0),
  markets: z.string().catch(""),
});

export const Route = createFileRoute("/review")({
  validateSearch: reviewSearchSchema,
  head: () => ({
    meta: [{ title: "Review Your Plan — HAKKIU" }],
  }),
  component: ReviewPage,
});

const BLUE = "oklch(0.58_0.18_255)";

function ReviewPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();

  const tmAddon = TM_ADD_ON[search.tm] ?? 0;
  const marketplaceAddon = search.marketplace * MARKETPLACE_PRICE;
  const domainAddon = search.domain > 0 ? DOMAIN_PRICE : 0;
  const total = BASE_PRICE + tmAddon + marketplaceAddon + domainAddon;

  const selectedMarkets = search.markets
    ? search.markets.split(",").filter(Boolean)
    : [];

  function handleContinue() {
    navigate({
      to: "/checkout",
      search: {
        plan: search.plan,
        interval: search.interval,
        tm: search.tm,
        marketplace: search.marketplace,
        domain: search.domain,
      },
    });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-6">
          <Button asChild variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
            <Link to="/configure">
              <ArrowLeft className="h-4 w-4" />
              Edit plan
            </Link>
          </Button>
          <HakkiuLogo className="h-7 text-foreground" />
          <div className="w-24" />
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-6 py-10">
        {/* Progress indicator */}
        <div className="mb-10 flex items-center justify-center gap-3 text-sm">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[oklch(0.58_0.18_255)] text-xs font-bold text-white">✓</span>
            Configure
          </span>
          <span className="h-px w-8 bg-border" />
          <span className="flex items-center gap-1.5 font-semibold text-foreground">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[oklch(0.58_0.18_255)] text-xs font-bold text-white">2</span>
            Review
          </span>
          <span className="h-px w-8 bg-border" />
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="flex h-6 w-6 items-center justify-center rounded-full border border-border text-xs font-bold">3</span>
            Payment
          </span>
          <span className="h-px w-8 bg-border" />
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="flex h-6 w-6 items-center justify-center rounded-full border border-border text-xs font-bold">4</span>
            Account
          </span>
        </div>

        <div className="mb-8 text-center">
          <h1 className="font-display text-3xl font-bold tracking-tight">Review your plan</h1>
          <p className="mt-2 text-muted-foreground">Confirm your selections before entering payment details.</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          {/* Left: selected items */}
          <div className="space-y-4">
            {/* Base plan */}
            <ReviewRow
              icon={<Shield className="h-5 w-5" style={{ color: BLUE }} />}
              title="Base plan — Self-Serve"
              description="Unlimited detections & takedowns · AI scoring · branded reports · Amazon included"
              price={`€${BASE_PRICE}/mo`}
            />

            {/* TM count */}
            <ReviewRow
              icon={<span className="flex h-5 w-5 items-center justify-center rounded-full bg-[oklch(0.58_0.18_255)] text-[10px] font-bold text-white">{search.tm}</span>}
              title={`${search.tm} Trademark${search.tm > 1 ? "s" : ""}`}
              description={`Monitoring ${search.tm} brand name${search.tm > 1 ? "s" : ""} across all platforms`}
              price={`+€${tmAddon}/mo`}
            />

            {/* Marketplaces */}
            <ReviewRow
              icon={<ShoppingBag className="h-5 w-5" style={{ color: BLUE }} />}
              title={`${1 + search.marketplace} Marketplace${(1 + search.marketplace) > 1 ? "s" : ""}`}
              description={
                search.marketplace === 0
                  ? "Amazon (included in base)"
                  : `Amazon + ${selectedMarkets.map((k) => MARKETPLACE_LABELS[k] ?? k).join(", ") || `${search.marketplace} additional`}`
              }
              price={search.marketplace > 0 ? `+€${marketplaceAddon}/mo` : "Included"}
              priceHighlight={search.marketplace === 0}
            />

            {/* Domain protection */}
            {search.domain > 0 && (
              <ReviewRow
                icon={<Globe className="h-5 w-5" style={{ color: BLUE }} />}
                title="Domain &amp; website protection"
                description="WHOIS monitoring · phishing detection · typosquatting alerts"
                price={`+€${DOMAIN_PRICE}/mo`}
              />
            )}

            {/* What's always included */}
            <div className="rounded-2xl border border-border bg-muted/20 p-5">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Always included</p>
              <ul className="grid gap-2 sm:grid-cols-2">
                {[
                  "Unlimited detections",
                  "Unlimited takedowns",
                  "AI confidence scoring",
                  "Auto takedown documents",
                  "Branded PDF reports",
                  "Unlimited team members",
                  "Live enforcement dashboard",
                  "Email support",
                ].map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" style={{ color: BLUE }} strokeWidth={2.5} />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Right: price summary + CTA */}
          <div>
            <div className="sticky top-24 rounded-2xl border border-[oklch(0.58_0.18_255)] bg-card p-6 shadow-[0_8px_30px_-8px_rgba(37,64,235,0.25)]">
              <p className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Order summary</p>

              <div className="space-y-2.5 text-sm">
                <SummaryRow label="Base plan" value={`€${BASE_PRICE}`} />
                <SummaryRow label={`${search.tm} trademark${search.tm > 1 ? "s" : ""}`} value={`+€${tmAddon}`} />
                {search.marketplace > 0 && (
                  <SummaryRow label={`${search.marketplace} extra platform${search.marketplace > 1 ? "s" : ""}`} value={`+€${marketplaceAddon}`} />
                )}
                {search.domain > 0 && (
                  <SummaryRow label="Domain protection" value={`+€${DOMAIN_PRICE}`} />
                )}
              </div>

              <div className="mt-4 border-t border-border pt-4">
                <div className="flex items-baseline justify-between">
                  <span className="font-semibold">Monthly total</span>
                  <span className="font-display text-3xl font-bold" style={{ color: BLUE }}>
                    €{total.toLocaleString("en-EU")}
                    <span className="text-sm font-normal text-muted-foreground">/mo</span>
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Flat monthly fee · cancel anytime</p>
              </div>

              <Button
                onClick={handleContinue}
                size="lg"
                className="mt-6 w-full font-semibold bg-[oklch(0.58_0.18_255)] text-white hover:bg-[oklch(0.54_0.18_255)]"
              >
                Confirm scope and pay
                <ChevronRight className="ml-1.5 h-4 w-4" />
              </Button>

              <p className="mt-3 text-center text-xs text-muted-foreground">
                You'll create your account after payment
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border mt-16">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-6 py-6 text-xs text-muted-foreground">
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

function ReviewRow({
  icon,
  title,
  description,
  price,
  priceHighlight = false,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  price: string;
  priceHighlight?: boolean;
}) {
  return (
    <div className="flex items-start gap-4 rounded-2xl border border-border bg-card p-5">
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[oklch(0.58_0.18_255)]/8">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold" dangerouslySetInnerHTML={{ __html: title }} />
        <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      </div>
      <span
        className={cn(
          "shrink-0 text-sm font-semibold",
          priceHighlight ? "text-[oklch(0.55_0.13_155)]" : "text-[oklch(0.58_0.18_255)]",
        )}
      >
        {price}
      </span>
    </div>
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
