import { useState, useEffect } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { z } from "zod";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, Loader2, Lock, ArrowLeft, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

const checkoutSearchSchema = z.object({
  plan: z.string().catch("pro"),
});

export const Route = createFileRoute("/checkout")({
  validateSearch: checkoutSearchSchema,
  head: () => ({
    meta: [
      { title: "Checkout — Tracemark" },
      { name: "description", content: "Complete your subscription upgrade securely." },
    ],
  }),
  component: CheckoutPage,
});

const PLANS = {
  starter: { name: "Starter Plan", price: 49, interval: "mo" },
  pro: { name: "Pro Plan", price: 199, interval: "mo" },
  firm: { name: "Firm Plan", price: 599, interval: "mo" },
};

function CheckoutPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const { user } = useAuth();
  
  const planId = search.plan as keyof typeof PLANS;
  const plan = PLANS[planId] || PLANS.pro;

  const [name, setName] = useState(user?.user_metadata?.full_name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [zip, setZip] = useState("");
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState(0);

  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, "").replace(/[^0-9]/gi, "");
    const matches = v.match(/\d{4,16}/g);
    const match = (matches && matches[0]) || "";
    const parts = [];

    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }

    if (parts.length > 0) {
      return parts.join(" ");
    } else {
      return v;
    }
  };

  const formatExpiry = (value: string) => {
    const v = value.replace(/\s+/g, "").replace(/[^0-9]/gi, "");
    if (v.length >= 2) {
      return `${v.slice(0, 2)}/${v.slice(2, 4)}`;
    }
    return v;
  };

  const handlePay = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardNumber || !expiry || !cvc || !zip) {
      toast.error("Please fill in all credit card details.");
      return;
    }
    setIsProcessing(true);
  };

  useEffect(() => {
    if (!isProcessing) return;

    const steps = [
      "Contacting secure vault...",
      "Validating dynamic check...",
      "Authorizing recurring payment profile...",
      "Applying seat licenses...",
    ];

    const timer = setInterval(() => {
      setProcessingStep((prev) => {
        if (prev >= steps.length - 1) {
          clearInterval(timer);
          setTimeout(() => {
            navigate({
              to: "/billing/success",
              search: { plan: planId || "pro" },
            });
          }, 600);
          return prev;
        }
        return prev + 1;
      });
    }, 800);

    return () => clearInterval(timer);
  }, [isProcessing, navigate, planId]);

  const steps = [
    "Contacting secure vault...",
    "Validating dynamic check...",
    "Authorizing recurring payment profile...",
    "Applying seat licenses...",
  ];

  return (
    <div className="mx-auto max-w-4xl py-6 space-y-6">
      {/* Back button */}
      <div>
        <Button variant="ghost" size="sm" asChild className="gap-2">
          <Link to="/plans">
            <ArrowLeft className="h-4 w-4" /> Back to Plans
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-12">
        {/* Left Column - Checkout Form */}
        <div className="md:col-span-7">
          <Card className="border-border/60 shadow-lg relative overflow-hidden bg-card/50 backdrop-blur-sm">
            {isProcessing && (
              <div className="absolute inset-0 bg-background/95 z-50 flex flex-col items-center justify-center p-6 text-center animate-fade-in animate-duration-300">
                <Loader2 className="h-10 w-10 animate-spin text-accent mb-4" />
                <h3 className="text-lg font-semibold tracking-tight">Processing Payment</h3>
                <p className="text-sm text-muted-foreground mt-2 max-w-xs h-6 transition-all duration-300">
                  {steps[processingStep]}
                </p>
                <div className="mt-8 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                  <Lock className="h-3 w-3" /> PCI-DSS Compliant Encryption Active
                </div>
              </div>
            )}

            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl font-semibold">
                <CreditCard className="h-5 w-5 text-accent" /> Secure Checkout
              </CardTitle>
              <CardDescription>Enter your billing details to complete your plan upgrade.</CardDescription>
            </CardHeader>

            <form onSubmit={handlePay}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name on Card</Label>
                  <Input
                    id="name"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Jane Doe"
                    className="bg-background/50 focus:border-accent"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Billing Email</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="jane.doe@example.com"
                    className="bg-background/50 focus:border-accent"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cardNumber">Card Number</Label>
                  <div className="relative">
                    <Input
                      id="cardNumber"
                      required
                      value={cardNumber}
                      onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                      placeholder="4111 2222 3333 4444"
                      maxLength={19}
                      className="bg-background/50 pr-10 font-mono tracking-widest focus:border-accent"
                    />
                    <Lock className="absolute right-3 top-3 h-4 w-4 text-muted-foreground/60" />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-1 space-y-2">
                    <Label htmlFor="expiry">Expiry</Label>
                    <Input
                      id="expiry"
                      required
                      value={expiry}
                      onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                      placeholder="MM/YY"
                      maxLength={5}
                      className="bg-background/50 font-mono text-center focus:border-accent"
                    />
                  </div>
                  <div className="col-span-1 space-y-2">
                    <Label htmlFor="cvc">CVC</Label>
                    <Input
                      id="cvc"
                      required
                      type="password"
                      value={cvc}
                      onChange={(e) => setCvc(e.target.value.replace(/\D/g, ""))}
                      placeholder="•••"
                      maxLength={4}
                      className="bg-background/50 font-mono text-center focus:border-accent"
                    />
                  </div>
                  <div className="col-span-1 space-y-2">
                    <Label htmlFor="zip">ZIP / Postal</Label>
                    <Input
                      id="zip"
                      required
                      value={zip}
                      onChange={(e) => setZip(e.target.value.toUpperCase())}
                      placeholder="90210"
                      className="bg-background/50 text-center focus:border-accent"
                    />
                  </div>
                </div>

                <div className="pt-2 flex items-start gap-2.5 bg-accent/5 border border-accent/10 rounded-lg p-3 text-xs text-muted-foreground leading-relaxed">
                  <ShieldCheck className="h-4.5 w-4.5 text-accent shrink-0 mt-0.5" />
                  <span>
                    Your upgrade to the <span className="font-semibold text-foreground">{plan.name}</span> will take effect immediately. Subscriptions are billed monthly and can be cancelled any time.
                  </span>
                </div>
              </CardContent>

              <CardFooter className="flex flex-col gap-3">
                <Button type="submit" className="w-full font-semibold cursor-pointer">
                  Upgrade & Pay ${plan.price}/month
                </Button>
                <Button variant="ghost" asChild className="w-full text-muted-foreground hover:text-foreground">
                  <Link to="/billing/cancel">Cancel Checkout</Link>
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>

        {/* Right Column - Order Summary */}
        <div className="md:col-span-5">
          <Card className="border-border bg-card/35 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{plan.name} (Monthly)</span>
                <span className="font-semibold">${plan.price}.00</span>
              </div>
              <hr className="border-border/60" />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Setup fee</span>
                <span className="text-emerald-500 font-medium">Free</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tax</span>
                <span>$0.00</span>
              </div>
              <hr className="border-border" />
              <div className="flex justify-between items-baseline">
                <span className="text-sm font-semibold">Total due today</span>
                <span className="text-xl font-bold text-accent">${plan.price}.00</span>
              </div>
            </CardContent>
            <CardFooter className="bg-muted/20 border-t border-border/40 py-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Lock className="h-3.5 w-3.5 text-muted-foreground/80" /> Billed securely via Stripe Mock
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
