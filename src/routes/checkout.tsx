import { useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Loader2, Lock, ArrowLeft, CreditCard, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { stripePromise, isStripeConfigured } from "@/lib/stripe";
import {
  getPlan,
  ADDONS,
  effectiveMonthly,
  intervalTotal,
  type BillingInterval,
} from "@/lib/billing";
import {
  createSubscription,
  updateSubscription,
  getSubscription,
  type AddonSelection,
} from "@/lib/api";

const checkoutSearchSchema = z.object({
  plan: z.string().catch("growth"),
  interval: z.enum(["month", "year"]).catch("month"),
});

export const Route = createFileRoute("/checkout")({
  validateSearch: checkoutSearchSchema,
  head: () => ({
    meta: [
      { title: "Checkout — HAKKIU" },
      { name: "description", content: "Complete your subscription upgrade securely." },
    ],
  }),
  component: CheckoutPage,
});

function CheckoutPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const interval = search.interval as BillingInterval;
  const plan = getPlan(search.plan) ?? getPlan("growth")!;

  // Is the user already subscribed? Then this is a plan change (uses the card on
  // file via update-subscription) rather than a fresh checkout. We must wait for
  // this query before acting — otherwise a subscriber could hit create (409).
  const { data: currentSub, isLoading: subLoading } = useQuery({
    queryKey: ["billing_subscription"],
    queryFn: getSubscription,
  });
  const hasActiveSub = ["active", "trialing", "past_due"].includes(currentSub?.status ?? "");

  // addon key -> quantity (0 = not selected)
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);

  const selectedAddons: AddonSelection[] = ADDONS.filter((a) => (quantities[a.key] ?? 0) > 0).map(
    (a) => ({ key: a.key, quantity: quantities[a.key] }),
  );

  const planMonthly = plan.monthly ?? 0;
  const addonsMonthly = selectedAddons.reduce((sum, sel) => {
    const meta = ADDONS.find((a) => a.key === sel.key);
    return sum + (meta ? meta.price * sel.quantity : 0);
  }, 0);
  const monthlyTotal = planMonthly + addonsMonthly;
  const dueToday = intervalTotal(monthlyTotal, interval);

  function setQty(key: string, next: number) {
    setQuantities((q) => ({ ...q, [key]: Math.max(0, next) }));
  }

  async function handleContinue() {
    if (!isStripeConfigured) {
      toast.error("Payments are not configured (missing Stripe key).");
      return;
    }
    setPreparing(true);
    try {
      if (hasActiveSub) {
        // Plan change: swap the plan/add-ons on the existing subscription and
        // bill the card on file (proration). No new card entry needed.
        await updateSubscription({ plan: plan.id, interval, addons: selectedAddons });
        await queryClient.invalidateQueries({ queryKey: ["billing_subscription"] });
        await queryClient.invalidateQueries({ queryKey: ["billing_invoices"] });
        toast.success("Plan updated!");
        navigate({ to: "/billing/success", search: { plan: plan.id, interval } });
        return;
      }
      const { client_secret } = await createSubscription({
        plan: plan.id,
        interval,
        addons: selectedAddons,
      });
      setClientSecret(client_secret);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start checkout.");
    } finally {
      setPreparing(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl py-6 space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="gap-2">
          <Link to="/plans">
            <ArrowLeft className="h-4 w-4" /> Back to Plans
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-12">
        {/* Left: payment / add-on selection */}
        <div className="md:col-span-7">
          <Card className="border-border/60 shadow-lg bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl font-semibold">
                <CreditCard className="h-5 w-5 text-accent" /> Secure Checkout
              </CardTitle>
              <CardDescription>
                {clientSecret
                  ? "Enter your card details to complete your subscription."
                  : hasActiveSub
                    ? "Choose your add-ons, then confirm your plan change."
                    : "Choose your add-ons, then continue to payment."}
              </CardDescription>
            </CardHeader>

            {!clientSecret ? (
              <>
                <CardContent className="space-y-3">
                  <p className="text-sm font-medium">Add-ons (optional)</p>
                  {ADDONS.map((addon) => {
                    const qty = quantities[addon.key] ?? 0;
                    return (
                      <div
                        key={addon.key}
                        className="flex items-start justify-between gap-3 rounded-lg border p-3"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{addon.name}</p>
                          <p className="text-xs text-muted-foreground">
                            ${addon.price}/mo per {addon.unit}
                          </p>
                        </div>
                        {addon.perUnit ? (
                          <div className="flex items-center gap-2 shrink-0">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => setQty(addon.key, qty - 1)}
                              disabled={qty === 0}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-6 text-center text-sm tabular-nums">{qty}</span>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => setQty(addon.key, qty + 1)}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            type="button"
                            variant={qty > 0 ? "default" : "outline"}
                            size="sm"
                            className="shrink-0"
                            onClick={() => setQty(addon.key, qty > 0 ? 0 : 1)}
                          >
                            {qty > 0 ? "Added" : "Add"}
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
                <CardFooter className="flex flex-col gap-3">
                  <Button
                    className="w-full font-semibold cursor-pointer"
                    onClick={handleContinue}
                    disabled={preparing || subLoading}
                  >
                    {preparing || subLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />{" "}
                        {subLoading ? "Loading…" : hasActiveSub ? "Updating…" : "Preparing…"}
                      </>
                    ) : hasActiveSub ? (
                      "Confirm plan change"
                    ) : (
                      "Continue to payment"
                    )}
                  </Button>
                </CardFooter>
              </>
            ) : (
              <Elements
                stripe={stripePromise}
                options={{ clientSecret, appearance: { theme: "stripe" } }}
              >
                <PaymentForm plan={plan.id} interval={interval} dueToday={dueToday} />
              </Elements>
            )}
          </Card>
        </div>

        {/* Right: order summary */}
        <div className="md:col-span-5">
          <Card className="border-border bg-card/35 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {plan.name} ({interval === "year" ? "Yearly" : "Monthly"})
                </span>
                <span className="font-semibold">
                  ${effectiveMonthly(planMonthly, interval).toLocaleString()}/mo
                </span>
              </div>
              {selectedAddons.map((sel) => {
                const meta = ADDONS.find((a) => a.key === sel.key)!;
                return (
                  <div key={sel.key} className="flex justify-between text-muted-foreground">
                    <span>
                      {meta.name}
                      {meta.perUnit ? ` ×${sel.quantity}` : ""}
                    </span>
                    <span>${(meta.price * sel.quantity).toLocaleString()}/mo</span>
                  </div>
                );
              })}
              <hr className="border-border/60" />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Setup fee</span>
                <span className="text-emerald-500 font-medium">Free</span>
              </div>
              <hr className="border-border" />
              <div className="flex justify-between items-baseline">
                <span className="font-semibold">Total due today</span>
                <span className="text-xl font-bold text-accent">
                  ${dueToday.toLocaleString()}.00
                </span>
              </div>
              {interval === "year" && (
                <p className="text-xs text-muted-foreground">
                  Billed yearly — equivalent to ${monthlyTotal.toLocaleString()}/mo at the monthly
                  rate.
                </p>
              )}
            </CardContent>
            <CardFooter className="bg-muted/20 border-t border-border/40 py-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Lock className="h-3.5 w-3.5" /> Billed securely via Stripe
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}

function PaymentForm({
  plan,
  interval,
  dueToday,
}: {
  plan: string;
  interval: BillingInterval;
  dueToday: number;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  async function handlePay(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
      confirmParams: {
        return_url: `${window.location.origin}/billing/success?plan=${plan}&interval=${interval}`,
      },
    });

    if (error) {
      toast.error(error.message ?? "Payment failed. Please try again.");
      setSubmitting(false);
      return;
    }

    if (paymentIntent && paymentIntent.status === "succeeded") {
      navigate({ to: "/billing/success", search: { plan, interval } });
    } else {
      // 3DS / redirect flows land back via return_url; otherwise wait for webhook.
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handlePay}>
      <CardContent className="space-y-4">
        <PaymentElement />
        <div className="pt-1 flex items-start gap-2.5 bg-accent/5 border border-accent/10 rounded-lg p-3 text-xs text-muted-foreground leading-relaxed">
          <ShieldCheck className="h-4 w-4 text-accent shrink-0 mt-0.5" />
          <span>
            Subscriptions renew {interval === "year" ? "yearly" : "monthly"} and can be cancelled
            any time.
          </span>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col gap-3">
        <Button
          type="submit"
          className="w-full font-semibold cursor-pointer"
          disabled={!stripe || submitting}
        >
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing…
            </>
          ) : (
            `Pay $${dueToday.toLocaleString()}`
          )}
        </Button>
        <Button
          variant="ghost"
          asChild
          className="w-full text-muted-foreground hover:text-foreground"
        >
          <Link to="/billing/cancel">Cancel Checkout</Link>
        </Button>
      </CardFooter>
    </form>
  );
}
