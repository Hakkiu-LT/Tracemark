import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { getSubscription } from "@/lib/api";
import { getPlan } from "@/lib/billing";

const successSearchSchema = z.object({
  plan: z.string().catch("growth"),
  interval: z.enum(["month", "year"]).catch("month"),
});

export const Route = createFileRoute("/billing/success")({
  validateSearch: successSearchSchema,
  head: () => ({
    meta: [
      { title: "Payment Successful — Tracemark" },
      { name: "description", content: "Your subscription has been activated." },
    ],
  }),
  component: SuccessPage,
});

const ACTIVE_STATUSES = ["active", "trialing"];

function SuccessPage() {
  const search = Route.useSearch();
  const { user, refreshProfile } = useAuth();

  const planName = getPlan(search.plan)?.name ?? "your new plan";
  const [status, setStatus] = useState<"pending" | "active" | "timeout">("pending");

  // Keep the latest refreshProfile without making it an effect dependency —
  // otherwise its changing identity would restart the poll loop every render.
  const refreshRef = useRef(refreshProfile);
  refreshRef.current = refreshProfile;

  // The webhook is the source of truth: poll our backend until the subscription
  // flips to active, rather than writing the plan from the browser. Runs once
  // per user.
  useEffect(() => {
    if (!user) return;
    let active = true;
    let attempts = 0;

    async function poll() {
      try {
        const sub = await getSubscription();
        if (!active) return;
        if (ACTIVE_STATUSES.includes(sub.status)) {
          setStatus("active");
          await refreshRef.current();
          toast.success("Subscription activated!");
          return;
        }
      } catch {
        // ignore transient errors; keep polling
      }
      attempts += 1;
      if (attempts >= 10) {
        if (active) setStatus("timeout");
        return;
      }
      if (active) setTimeout(poll, 1500);
    }

    poll();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const isPending = status === "pending";

  return (
    <div className="flex min-h-[75vh] items-center justify-center p-4">
      <Card className="w-full max-w-md border-border/80 shadow-2xl relative overflow-hidden bg-card/65 backdrop-blur-sm text-center">
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-500 via-accent to-blue-500" />

        <CardHeader className="pt-8">
          <div className="flex justify-center mb-4">
            {isPending ? (
              <div className="h-16 w-16 rounded-full bg-accent/10 flex items-center justify-center animate-pulse">
                <Loader2 className="h-8 w-8 text-accent animate-spin" />
              </div>
            ) : (
              <div className="h-16 w-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle2 className="h-10 w-10 text-emerald-500" />
              </div>
            )}
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">
            {isPending ? "Confirming your payment…" : "You're all set!"}
          </CardTitle>
          <CardDescription className="text-sm text-muted-foreground mt-1">
            {status === "timeout"
              ? "Your payment is being processed. This can take a moment — your plan will update automatically."
              : "Thank you for subscribing to Tracemark."}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 px-6 pb-6">
          <div className="rounded-lg bg-muted/40 p-4 border border-border/40 text-sm">
            <span className="text-muted-foreground block text-xs font-semibold uppercase tracking-wider mb-1">
              Subscription
            </span>
            <span className="text-lg font-bold text-foreground">{planName}</span>
            <span className="text-xs text-muted-foreground block mt-1">
              Billed {search.interval === "year" ? "yearly" : "monthly"} · {user?.email}
            </span>
          </div>
        </CardContent>

        <CardFooter className="bg-muted/10 border-t border-border/50 p-6 flex flex-col gap-3">
          <Button asChild className="w-full cursor-pointer font-semibold gap-2">
            <Link to="/dashboard">
              Go to Dashboard <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button variant="outline" asChild className="w-full cursor-pointer">
            <Link to="/settings/billing">View Billing</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
