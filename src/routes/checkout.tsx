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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, Loader2, Lock, ArrowLeft, CreditCard, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { stripePromise, isStripeConfigured } from "@/lib/stripe";
import {
  getPlan,
  ADDONS,
  effectiveMonthly,
  intervalTotal,
  selfServeAddons,
  SELF_SERVE_TM_PRICES,
  SELF_SERVE_MARKETPLACE_PRICE,
  SELF_SERVE_DOMAIN_PRICE,
  SELF_SERVE_BASE_PRICE,
  type BillingInterval,
} from "@/lib/billing";
import {
  createSubscription,
  updateSubscription,
  getSubscription,
  guestSubscribe,
  type AddonSelection,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";

const checkoutSearchSchema = z.object({
  plan: z.string().catch("growth"),
  interval: z.enum(["month", "year"]).catch("month"),
  tm: z.coerce.number().min(1).max(5).optional(),
  marketplace: z.coerce.number().min(0).max(11).optional(),
  domain: z.coerce.number().min(0).max(1).optional(),
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

// ── Shared order summary ──────────────────────────────────────────────────────

function OrderSummary({
  planName,
  planMonthly,
  dueToday,
  interval,
  selectedAddons = [],
}: {
  planName: string;
  planMonthly: number;
  dueToday: number;
  interval: BillingInterval;
  selectedAddons?: AddonSelection[];
}) {
  return (
    <Card className="border-border bg-card/35 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-base font-semibold">Order Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">
            {planName} ({interval === "year" ? "Yearly" : "Monthly"})
          </span>
          <span className="font-semibold">
            €{effectiveMonthly(planMonthly, interval).toLocaleString()}/mo
          </span>
        </div>
        {selectedAddons.map((sel) => {
          const meta = ADDONS.find((a) => a.key === sel.key);
          if (!meta) return null;
          return (
            <div key={sel.key} className="flex justify-between text-muted-foreground">
              <span>
                {meta.name}
                {meta.perUnit ? ` ×${sel.quantity}` : ""}
              </span>
              <span>€{(meta.price * sel.quantity).toLocaleString()}/mo</span>
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
          <span className="text-xl font-bold text-accent">€{dueToday.toLocaleString()}.00</span>
        </div>
        {interval === "year" && (
          <p className="text-xs text-muted-foreground">
            Billed yearly — equivalent to €{planMonthly.toLocaleString()}/mo.
          </p>
        )}
      </CardContent>
      <CardFooter className="bg-muted/20 border-t border-border/40 py-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <Lock className="h-3.5 w-3.5" /> Billed securely via Stripe
      </CardFooter>
    </Card>
  );
}

// ── Guest payment form (no auth required) ────────────────────────────────────

function GuestPaymentInner({
  plan,
  interval,
  dueToday,
  subscriptionId,
  guestEmail,
}: {
  plan: string;
  interval: BillingInterval;
  dueToday: number;
  subscriptionId: string;
  guestEmail: string;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  async function handlePay(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);

    const returnUrl = `${window.location.origin}/billing/success?plan=${plan}&interval=${interval}&email=${encodeURIComponent(guestEmail)}&subscription_id=${encodeURIComponent(subscriptionId)}`;

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
      confirmParams: { return_url: returnUrl },
    });

    if (error) {
      toast.error(error.message ?? "Payment failed. Please try again.");
      setSubmitting(false);
      return;
    }

    if (paymentIntent && paymentIntent.status === "succeeded") {
      navigate({
        to: "/billing/success",
        search: { plan, interval, email: guestEmail, subscription_id: subscriptionId },
      });
    } else {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handlePay}>
      <CardContent className="space-y-4">
        <PaymentElement />
        <div className="flex items-start gap-2.5 bg-accent/5 border border-accent/10 rounded-lg p-3 text-xs text-muted-foreground leading-relaxed">
          <ShieldCheck className="h-4 w-4 text-accent shrink-0 mt-0.5" />
          <span>
            Subscriptions renew {interval === "year" ? "yearly" : "monthly"} and can be cancelled any time.
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
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing…</>
          ) : (
            `Pay €${dueToday.toLocaleString()}`
          )}
        </Button>
        <Button variant="ghost" asChild className="w-full text-muted-foreground hover:text-foreground">
          <Link to="/review">Cancel</Link>
        </Button>
      </CardFooter>
    </form>
  );
}

function GuestCheckout({
  plan,
  interval,
  planName,
  planMonthly,
  dueToday,
  selectedAddons,
}: {
  plan: string;
  interval: BillingInterval;
  planName: string;
  planMonthly: number;
  dueToday: number;
  selectedAddons: AddonSelection[];
}) {
  const [email, setEmail] = useState("");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);

  async function handleContinue(e: React.FormEvent) {
    e.preventDefault();
    if (!isStripeConfigured) {
      toast.error("Payments are not configured.");
      return;
    }
    setPreparing(true);
    try {
      const res = await guestSubscribe({ email, plan, interval, addons: selectedAddons });
      setClientSecret(res.client_secret);
      setSubscriptionId(res.subscription_id);
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
          <Link to="/review">
            <ArrowLeft className="h-4 w-4" /> Back to review
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-12">
        <div className="md:col-span-7">
          <Card className="border-border/60 shadow-lg bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl font-semibold">
                <CreditCard className="h-5 w-5 text-accent" /> Payment details
              </CardTitle>
              <CardDescription>
                {clientSecret
                  ? "Enter your card details to complete purchase."
                  : "Enter your email address to continue to payment."}
              </CardDescription>
            </CardHeader>

            {!clientSecret ? (
              <form onSubmit={handleContinue}>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="guest-email">Work email</Label>
                    <Input
                      id="guest-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@company.com"
                      className="h-11"
                    />
                    <p className="text-xs text-muted-foreground">
                      You'll use this email to create your account after payment.
                    </p>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button
                    type="submit"
                    className="w-full font-semibold cursor-pointer"
                    disabled={preparing || !email}
                  >
                    {preparing ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Preparing…</>
                    ) : (
                      "Continue to payment →"
                    )}
                  </Button>
                </CardFooter>
              </form>
            ) : (
              <Elements
                stripe={stripePromise}
                options={{ clientSecret, appearance: { theme: "stripe" } }}
              >
                <GuestPaymentInner
                  plan={plan}
                  interval={interval}
                  dueToday={dueToday}
                  subscriptionId={subscriptionId!}
                  guestEmail={email}
                />
              </Elements>
            )}
          </Card>
        </div>

        <div className="md:col-span-5">
          <OrderSummary
            planName={planName}
            planMonthly={planMonthly}
            dueToday={dueToday}
            interval={interval}
            selectedAddons={selectedAddons}
          />
        </div>
      </div>
    </div>
  );
}

// ── Authenticated checkout (existing subscriber upgrading) ────────────────────

function AuthCheckout({
  plan,
  interval,
  planName,
  planMonthly,
  dueToday,
  selectedAddons,
  isSelfServe,
}: {
  plan: string;
  interval: BillingInterval;
  planName: string;
  planMonthly: number;
  dueToday: number;
  selectedAddons: AddonSelection[];
  isSelfServe: boolean;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: currentSub, isLoading: subLoading } = useQuery({
    queryKey: ["billing_subscription"],
    queryFn: getSubscription,
  });
  const hasActiveSub = ["active", "trialing", "past_due"].includes(currentSub?.status ?? "");

  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);

  function setQty(key: string, next: number) {
    setQuantities((q) => ({ ...q, [key]: Math.max(0, next) }));
  }

  async function handleContinue() {
    if (!isStripeConfigured) {
      toast.error("Payments are not configured.");
      return;
    }
    setPreparing(true);
    try {
      if (hasActiveSub) {
        await updateSubscription({ plan, interval, addons: selectedAddons });
        await queryClient.invalidateQueries({ queryKey: ["billing_subscription"] });
        await queryClient.invalidateQueries({ queryKey: ["billing_invoices"] });
        toast.success("Plan updated!");
        navigate({ to: "/billing/success", search: { plan, interval } });
        return;
      }
      const { client_secret } = await createSubscription({ plan, interval, addons: selectedAddons });
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
                    ? "Confirm your plan change."
                    : "Continue to payment."}
              </CardDescription>
            </CardHeader>

            {!clientSecret ? (
              <>
                <CardContent className="space-y-3">
                  {!isSelfServe &&
                    ADDONS.map((addon) => {
                      const qty = quantities[addon.key] ?? 0;
                      return (
                        <div key={addon.key} className="flex items-start justify-between gap-3 rounded-lg border p-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium">{addon.name}</p>
                            <p className="text-xs text-muted-foreground">
                              €{addon.price}/mo per {addon.unit}
                            </p>
                          </div>
                          {addon.perUnit ? (
                            <div className="flex items-center gap-2 shrink-0">
                              <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={() => setQty(addon.key, qty - 1)} disabled={qty === 0}>
                                <Minus className="h-3 w-3" />
                              </Button>
                              <span className="w-6 text-center text-sm tabular-nums">{qty}</span>
                              <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={() => setQty(addon.key, qty + 1)}>
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <Button type="button" variant={qty > 0 ? "default" : "outline"} size="sm" className="shrink-0" onClick={() => setQty(addon.key, qty > 0 ? 0 : 1)}>
                              {qty > 0 ? "Added" : "Add"}
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  {isSelfServe && (
                    <div className="rounded-lg bg-muted/30 p-4 text-sm text-muted-foreground">
                      Your plan is configured. Click below to enter payment details.
                    </div>
                  )}
                </CardContent>
                <CardFooter className="flex flex-col gap-3">
                  <Button className="w-full font-semibold cursor-pointer" onClick={handleContinue} disabled={preparing || subLoading}>
                    {preparing || subLoading ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{subLoading ? "Loading…" : hasActiveSub ? "Updating…" : "Preparing…"}</>
                    ) : hasActiveSub ? (
                      "Confirm plan change"
                    ) : (
                      "Continue to payment"
                    )}
                  </Button>
                </CardFooter>
              </>
            ) : (
              <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: "stripe" } }}>
                <AuthPaymentForm plan={plan} interval={interval} dueToday={dueToday} />
              </Elements>
            )}
          </Card>
        </div>

        <div className="md:col-span-5">
          <OrderSummary
            planName={planName}
            planMonthly={planMonthly}
            dueToday={dueToday}
            interval={interval}
            selectedAddons={selectedAddons}
          />
        </div>
      </div>
    </div>
  );
}

function AuthPaymentForm({ plan, interval, dueToday }: { plan: string; interval: BillingInterval; dueToday: number }) {
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
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handlePay}>
      <CardContent className="space-y-4">
        <PaymentElement />
        <div className="flex items-start gap-2.5 bg-accent/5 border border-accent/10 rounded-lg p-3 text-xs text-muted-foreground leading-relaxed">
          <ShieldCheck className="h-4 w-4 text-accent shrink-0 mt-0.5" />
          <span>Subscriptions renew {interval === "year" ? "yearly" : "monthly"} and can be cancelled any time.</span>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col gap-3">
        <Button type="submit" className="w-full font-semibold cursor-pointer" disabled={!stripe || submitting}>
          {submitting ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing…</>
          ) : (
            `Pay €${dueToday.toLocaleString()}`
          )}
        </Button>
        <Button variant="ghost" asChild className="w-full text-muted-foreground hover:text-foreground">
          <Link to="/billing/cancel">Cancel Checkout</Link>
        </Button>
      </CardFooter>
    </form>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────

function CheckoutPage() {
  const search = Route.useSearch();
  const { session, loading: authLoading } = useAuth();
  const interval = search.interval as BillingInterval;
  const plan = getPlan(search.plan) ?? getPlan("growth")!;
  const isSelfServe = plan.id === "self_serve";

  const ssTm = search.tm ?? 1;
  const ssMarketplace = search.marketplace ?? 0;
  const ssDomain = (search.domain ?? 0) > 0;

  const selectedAddons: AddonSelection[] = isSelfServe
    ? selfServeAddons(ssTm, ssMarketplace, ssDomain)
    : [];

  const planMonthly = isSelfServe
    ? SELF_SERVE_BASE_PRICE +
      (SELF_SERVE_TM_PRICES[ssTm] ?? 0) +
      ssMarketplace * SELF_SERVE_MARKETPLACE_PRICE +
      (ssDomain ? SELF_SERVE_DOMAIN_PRICE : 0)
    : plan.monthly ?? 0;
  const dueToday = intervalTotal(planMonthly, interval);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <span className="text-sm text-muted-foreground">Loading…</span>
      </div>
    );
  }

  // Unauthenticated: guest checkout — pay first, create account after
  if (!session) {
    return (
      <GuestCheckout
        plan={plan.id}
        interval={interval}
        planName={plan.name}
        planMonthly={planMonthly}
        dueToday={dueToday}
        selectedAddons={selectedAddons}
      />
    );
  }

  // Authenticated: existing user upgrading / re-subscribing
  return (
    <AuthCheckout
      plan={plan.id}
      interval={interval}
      planName={plan.name}
      planMonthly={planMonthly}
      dueToday={dueToday}
      selectedAddons={selectedAddons}
      isSelfServe={isSelfServe}
    />
  );
}
