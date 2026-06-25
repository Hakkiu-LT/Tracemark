import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useStore, type Persona } from "@/lib/store";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/plans")({
  head: () => ({ meta: [{ title: "Plans – Tracemark" }] }),
  component: PlansPage,
});

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    price: 49,
    blurb: "For founders protecting a single brand.",
    features: ["1 brand / 5 monitored marks", "Daily scans across 3 platforms", "Manual takedown workflow", "Email alerts"],
    audience: "brand_owner" as const,
  },
  {
    id: "pro",
    name: "Pro",
    price: 199,
    blurb: "For scaling e-commerce and SaaS teams.",
    features: ["Up to 5 brands / 50 marks", "Hourly scans, all platforms", "Automated DMCA + C&D templates", "Webhook + Slack alerts", "Evidence PDF export"],
    audience: "brand_owner" as const,
    highlight: true,
  },
  {
    id: "firm",
    name: "Firm",
    price: 599,
    blurb: "Multi-client workspace for IP practices.",
    features: ["Unlimited client tenants", "Per-client billing & reports", "White-label takedown letters", "Audit log + SSO", "Priority support"],
    audience: "law_firm" as const,
    highlight: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: null,
    blurb: "Custom volume, SLAs, and integrations.",
    features: ["Unlimited marks & scans", "Dedicated success manager", "Custom integrations & APIs", "Contractual SLAs", "On-prem evidence retention"],
    audience: "both" as const,
  },
];

function PlansPage() {
  const persona = useStore((s) => s.persona);
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Plans & Billing</h1>
        <p className="text-sm text-muted-foreground">Choose the plan that best fits your workspace.</p>
      </div>
      <PlansContent persona={persona} />
    </div>
  );
}

function PlansContent({ persona }: { persona: Persona }) {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const currentPlanId = profile?.plan || "free";
  const recommended = persona === "law_firm" ? "firm" : "pro";

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="text-base">Current plan</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              You're on <span className="font-medium text-foreground">{PLANS.find(p => p.id === currentPlanId)?.name || "Free"}</span>{currentPlanId !== "free" && ` — next invoice ${new Date(Date.now() + 12 * 86400000).toLocaleDateString()}.`}
            </p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/settings/billing">Manage billing</Link>
          </Button>
        </CardHeader>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {PLANS.filter(p => p.audience === "both" || p.audience === persona).map((plan) => {
          const isCurrent = plan.id === currentPlanId;
          const isRecommended = plan.id === recommended && !isCurrent;
          return (
            <div
              key={plan.id}
              className={cn(
                "relative flex flex-col rounded-lg border bg-card p-5",
                plan.highlight && "border-accent/50 shadow-sm",
                isCurrent && "ring-1 ring-accent"
              )}
            >
              {isRecommended && (
                <Badge className="absolute -top-2 right-4 gap-1 bg-accent text-accent-foreground hover:bg-accent">
                  <Sparkles className="h-3 w-3" /> Recommended
                </Badge>
              )}
              <div className="flex items-baseline justify-between">
                <p className="font-semibold">{plan.name}</p>
                {isCurrent && <span className="text-xs font-medium text-accent">Current</span>}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{plan.blurb}</p>
              <ul className="mt-4 flex-1 space-y-2 text-sm">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                    <span className="text-muted-foreground">{f}</span>
                  </li>
                ))}
              </ul>
              <Button
                className="mt-5 w-full cursor-pointer"
                variant={isCurrent ? "outline" : plan.highlight ? "default" : "outline"}
                disabled={isCurrent}
                onClick={() => {
                  if (plan.price === null) {
                    toast.info(`Please contact sales at sales@tracemark.io to negotiate Enterprise terms.`);
                  } else {
                    navigate({ to: "/checkout", search: { plan: plan.id } });
                  }
                }}
              >
                {isCurrent ? "Current plan" : plan.price === null ? "Contact sales" : `Upgrade to ${plan.name}`}
              </Button>
            </div>
          );
        })}
      </div>

    </>
  );
}
