import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useStore, type Persona } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { PLANS, effectiveMonthly, type BillingInterval } from "@/lib/billing";

export const Route = createFileRoute("/plans")({
  head: () => ({ meta: [{ title: "Plans – Tracemark" }] }),
  component: PlansPage,
});

function PlansPage() {
  const persona = useStore((s) => s.persona);
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Plans & Billing</h1>
        <p className="text-sm text-muted-foreground">
          Choose the plan that best fits your workspace.
        </p>
      </div>
      <PlansContent persona={persona} />
    </div>
  );
}

function PlansContent({ persona }: { persona: Persona }) {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [interval, setInterval] = useState<BillingInterval>("month");
  const currentPlanId = profile?.plan || "free";
  const recommended = persona === "law_firm" ? "agency" : "growth";

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="text-base">Current plan</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              You're on{" "}
              <span className="font-medium text-foreground">
                {PLANS.find((p) => p.id === currentPlanId)?.name || "Free"}
              </span>
              {currentPlanId !== "free" &&
                ` — next invoice ${new Date(Date.now() + 12 * 86400000).toLocaleDateString()}.`}
            </p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/settings/billing">Manage billing</Link>
          </Button>
        </CardHeader>
      </Card>

      {/* Billing interval toggle */}
      <div className="flex items-center justify-center">
        <div className="inline-flex rounded-lg border bg-muted/40 p-1 text-sm">
          <button
            type="button"
            onClick={() => setInterval("month")}
            className={cn(
              "cursor-pointer rounded-md px-4 py-1.5 font-medium transition-colors",
              interval === "month" ? "bg-background shadow-sm" : "text-muted-foreground",
            )}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setInterval("year")}
            className={cn(
              "cursor-pointer rounded-md px-4 py-1.5 font-medium transition-colors",
              interval === "year" ? "bg-background shadow-sm" : "text-muted-foreground",
            )}
          >
            Yearly <span className="text-accent">–2 months</span>
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {PLANS.filter((p) => p.audience === "both" || p.audience === persona).map((plan) => {
          const isCurrent = plan.id === currentPlanId;
          const isRecommended = plan.id === recommended && !isCurrent;
          const monthly = plan.monthly;
          const shownPrice = monthly !== null ? effectiveMonthly(monthly, interval) : null;
          const currentPlanMeta = PLANS.find((p) => p.id === currentPlanId);
          // Enterprise (monthly null) is the top tier → everything else downgrades;
          // free / unknown is the bottom → everything else upgrades.
          const currentMonthly = currentPlanMeta
            ? (currentPlanMeta.monthly ?? Number.POSITIVE_INFINITY)
            : 0;
          const isDowngrade = monthly !== null && monthly < currentMonthly;
          return (
            <div
              key={plan.id}
              className={cn(
                "relative flex flex-col rounded-lg border bg-card p-5",
                plan.highlight && "border-accent/50 shadow-sm",
                isCurrent && "ring-1 ring-accent",
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
              <div className="mt-2">
                {shownPrice !== null ? (
                  <>
                    <span className="text-2xl font-bold">${shownPrice.toLocaleString()}</span>
                    <span className="text-sm text-muted-foreground">/mo</span>
                    {interval === "year" && (
                      <span className="ml-1 text-xs text-muted-foreground">billed yearly</span>
                    )}
                  </>
                ) : (
                  <span className="text-2xl font-bold">Custom</span>
                )}
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
                  if (!plan.selfServe) {
                    toast.info(
                      "Please contact sales at sales@tracemark.io to negotiate Enterprise terms.",
                    );
                  } else {
                    navigate({ to: "/checkout", search: { plan: plan.id, interval } });
                  }
                }}
              >
                {isCurrent
                  ? "Current plan"
                  : !plan.selfServe
                    ? "Contact sales"
                    : `${isDowngrade ? "Downgrade" : "Upgrade"} to ${plan.name}`}
              </Button>
            </div>
          );
        })}
      </div>
    </>
  );
}
