import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { z } from "zod";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ShieldCheck, ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

const successSearchSchema = z.object({
  plan: z.string().catch("pro"),
});

export const Route = createFileRoute("/billing/success")({
  validateSearch: successSearchSchema,
  head: () => ({
    meta: [
      { title: "Payment Successful — Tracemark" },
      { name: "description", content: "Your subscription has been upgraded successfully." },
    ],
  }),
  component: SuccessPage,
});

const PLANS = {
  starter: "Starter Plan",
  pro: "Pro Plan",
  firm: "Firm Plan",
};

function SuccessPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const { user, refreshProfile } = useAuth();
  
  const planId = search.plan;
  const planName = PLANS[planId as keyof typeof PLANS] || PLANS.pro;

  const [isUpdating, setIsUpdating] = useState(true);

  useEffect(() => {
    if (!user) return;
    
    const userId = user.id;
    let active = true;
    async function updatePlan() {
      try {
        if (supabase) {
          const { error } = await supabase
            .from("profiles")
            .update({ plan: planId })
            .eq("id", userId);

          if (error) {
            console.error("DB update error:", error);
            if (active) toast.error("Failed to update subscription in your profile.");
          } else {
            await refreshProfile();
            if (active) toast.success("Subscription upgraded successfully!");
          }
        }
      } catch (err) {
        console.error("Profile sync exception:", err);
      } finally {
        if (active) setIsUpdating(false);
      }
    }

    updatePlan();

    return () => {
      active = false;
    };
  }, [user, planId, refreshProfile]);

  return (
    <div className="flex min-h-[75vh] items-center justify-center p-4">
      <Card className="w-full max-w-md border-border/80 shadow-2xl relative overflow-hidden bg-card/65 backdrop-blur-sm text-center">
        {/* Decorative background gradients */}
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-500 via-accent to-blue-500" />
        
        <CardHeader className="pt-8">
          <div className="flex justify-center mb-4">
            {isUpdating ? (
              <div className="h-16 w-16 rounded-full bg-accent/10 flex items-center justify-center animate-pulse">
                <Loader2 className="h-8 w-8 text-accent animate-spin" />
              </div>
            ) : (
              <div className="h-16 w-16 rounded-full bg-emerald-500/10 flex items-center justify-center animate-bounce-slow">
                <CheckCircle2 className="h-10 w-10 text-emerald-500" />
              </div>
            )}
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">Upgrade Successful!</CardTitle>
          <CardDescription className="text-sm text-muted-foreground mt-1">
            Thank you for upgrading your Tracemark workspace.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 px-6 pb-6">
          <div className="rounded-lg bg-muted/40 p-4 border border-border/40 text-sm">
            <span className="text-muted-foreground block text-xs font-semibold uppercase tracking-wider mb-1">
              CURRENT SUBSCRIPTION
            </span>
            <span className="text-lg font-bold text-foreground">{planName}</span>
            <span className="text-xs text-muted-foreground block mt-1">
              Active status synced to account {user?.email}
            </span>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed">
            All premium capabilities, including brand monitoring channels, notice auto-generation templates, and dashboard logs have been activated instantly.
          </p>
        </CardContent>

        <CardFooter className="bg-muted/10 border-t border-border/50 p-6 flex flex-col gap-3">
          <Button asChild className="w-full cursor-pointer font-semibold gap-2">
            <Link to="/dashboard">
              Go to Dashboard <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button variant="outline" asChild className="w-full cursor-pointer">
            <Link to="/settings/billing">
              View Billing Portal
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
