import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { activateSubscription } from "@/lib/api";
import { HakkiuMark } from "@/components/hakkiu-mark";

export const Route = createFileRoute("/auth/callback")({
  head: () => ({ meta: [{ title: "Signing in… — HAKKIU" }] }),
  component: CallbackPage,
});

function CallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    async function exchange() {
      if (!supabase) {
        navigate({ to: "/auth/sign-in", replace: true });
        return;
      }
      const code = new URLSearchParams(window.location.search).get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          toast.error(error.message);
          navigate({ to: "/auth/sign-in", replace: true });
          return;
        }
      }

      // After guest checkout with email confirmation: the success page stored the
      // Stripe subscription ID here so we can activate it once the session exists.
      const pendingSubId = localStorage.getItem("pending_subscription_id");
      if (pendingSubId) {
        localStorage.removeItem("pending_subscription_id");
        try {
          await activateSubscription({ stripe_subscription_id: pendingSubId });
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Could not activate subscription — contact support.");
        }
      }

      navigate({ to: "/dashboard", replace: true });
    }
    void exchange();
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <HakkiuMark className="h-8 w-8 shrink-0 text-primary" />
        <span className="text-sm">Signing you in…</span>
      </div>
    </div>
  );
}
