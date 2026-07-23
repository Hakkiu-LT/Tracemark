import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, ArrowRight, Loader2, Eye, EyeOff, MailCheck, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { getSubscription, activateSubscription } from "@/lib/api";
import { getPlan } from "@/lib/billing";
import { supabase } from "@/lib/supabase";

const successSearchSchema = z.object({
  plan: z.string().catch("growth"),
  interval: z.enum(["month", "year"]).catch("month"),
  // Guest checkout params — present only when paying without an account first.
  email: z.string().optional(),
  subscription_id: z.string().optional(),
});

export const Route = createFileRoute("/billing/success")({
  validateSearch: successSearchSchema,
  head: () => ({
    meta: [
      { title: "Payment Successful — HAKKIU" },
      { name: "description", content: "Your subscription has been activated." },
    ],
  }),
  component: SuccessPage,
});

const ACTIVE_STATUSES = ["active", "trialing"];

// ── Guest: account creation after payment ────────────────────────────────────

function CreateAccountAfterPayment({
  email,
  subscriptionId,
}: {
  email: string;
  subscriptionId: string;
}) {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [resending, setResending] = useState(false);
  const [resentAt, setResentAt] = useState<number | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return toast.error("Something went wrong. Please try again.");
    if (password !== confirm) return toast.error("Passwords do not match.");
    setLoading(true);

    // Create the Supabase account.
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
        emailRedirectTo: `${window.location.origin}/auth/callback?redirect=/dashboard`,
      },
    });

    if (error) {
      setLoading(false);
      toast.error(error.message);
      return;
    }

    // If session is immediately available (auto-confirm): bind subscription now.
    if (data.session) {
      try {
        await activateSubscription({ stripe_subscription_id: subscriptionId });
        navigate({ to: "/dashboard" });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not activate subscription.");
      }
    } else {
      // Email confirmation required — activation happens after they confirm.
      // Store subscription_id in localStorage so the callback page can activate it.
      localStorage.setItem("pending_subscription_id", subscriptionId);
      setSent(true);
    }
    setLoading(false);
  }

  async function handleResend() {
    if (!supabase) return;
    setResending(true);
    const { error } = await supabase.auth.resend({ type: "signup", email });
    setResending(false);
    if (error) {
      toast.error(error.message);
    } else {
      setResentAt(Date.now());
      toast.success("Confirmation email resent.");
    }
  }

  if (sent) {
    return (
      <div className="flex min-h-[75vh] items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/15 text-accent">
            <MailCheck className="relative h-7 w-7" />
          </div>
          <h2 className="mt-6 text-2xl font-semibold tracking-tight">Check your email</h2>
          <p className="mt-3 text-sm text-muted-foreground">
            We sent a confirmation link to{" "}
            <span className="font-medium text-foreground">{email}</span>. Click it to verify your
            account and access your dashboard.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Your payment is confirmed — no further action needed until you confirm your email.
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="mt-5 gap-2 text-muted-foreground"
            onClick={handleResend}
            disabled={resending || (resentAt !== null && Date.now() - resentAt < 60_000)}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${resending ? "animate-spin" : ""}`} />
            {resentAt ? "Resend again" : "Didn't receive it? Resend"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[75vh] items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Payment confirmed badge */}
        <div className="flex flex-col items-center text-center">
          <div className="h-14 w-14 rounded-full bg-emerald-500/10 flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
          </div>
          <h2 className="mt-4 text-2xl font-bold tracking-tight">Payment confirmed!</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Now create your account to access the dashboard.
          </p>
        </div>

        <Card className="border-border/60 shadow-lg bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Create your account</CardTitle>
            <CardDescription>Set up your HAKKIU workspace.</CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="sa-name">Full name</Label>
                <Input id="sa-name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" className="h-11" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sa-email">Email</Label>
                <Input id="sa-email" type="email" value={email} readOnly className="h-11 bg-muted/40 cursor-not-allowed" />
                <p className="text-xs text-muted-foreground">This is the email you used for payment.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sa-pass">Password</Label>
                <div className="relative">
                  <Input id="sa-pass" type={showPass ? "text" : "password"} autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="h-11 pr-10" />
                  <button type="button" onClick={() => setShowPass((v) => !v)} className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground">
                    {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">Minimum 8 characters.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sa-confirm">Confirm password</Label>
                <div className="relative">
                  <Input id="sa-confirm" type={showConfirm ? "text" : "password"} autoComplete="new-password" required minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} className="h-11 pr-10" />
                  <button type="button" onClick={() => setShowConfirm((v) => !v)} className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground">
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button type="submit" className="w-full font-semibold gap-2" disabled={loading}>
                {loading ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Creating account…</>
                ) : (
                  <>Create account &amp; go to dashboard <ArrowRight className="h-4 w-4" /></>
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}

// ── Authenticated success (existing user upgraded) ────────────────────────────

function AuthSuccessPage({ plan, interval }: { plan: string; interval: string }) {
  const { user, refreshProfile } = useAuth();
  const planName = getPlan(plan)?.name ?? "your new plan";
  const [status, setStatus] = useState<"pending" | "active" | "timeout">("pending");

  const refreshRef = useRef(refreshProfile);
  refreshRef.current = refreshProfile;

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
        // ignore
      }
      attempts += 1;
      if (attempts >= 10) {
        if (active) setStatus("timeout");
        return;
      }
      if (active) setTimeout(poll, 1500);
    }

    poll();
    return () => { active = false; };
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
              ? "Your payment is being processed. Your plan will update automatically."
              : "Thank you for subscribing to HAKKIU."}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 px-6 pb-6">
          <div className="rounded-lg bg-muted/40 p-4 border border-border/40 text-sm">
            <span className="text-muted-foreground block text-xs font-semibold uppercase tracking-wider mb-1">
              Subscription
            </span>
            <span className="text-lg font-bold text-foreground">{planName}</span>
            <span className="text-xs text-muted-foreground block mt-1">
              Billed {interval === "year" ? "yearly" : "monthly"} · {user?.email}
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

// ── Root ──────────────────────────────────────────────────────────────────────

function SuccessPage() {
  const search = Route.useSearch();

  // Guest flow: email + subscription_id in URL → show create-account form
  if (search.email && search.subscription_id) {
    return (
      <CreateAccountAfterPayment
        email={decodeURIComponent(search.email)}
        subscriptionId={decodeURIComponent(search.subscription_id)}
      />
    );
  }

  // Authenticated flow: existing user upgrading
  return <AuthSuccessPage plan={search.plan} interval={search.interval} />;
}
