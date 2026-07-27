import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
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
