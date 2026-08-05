import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { HakkiuMark } from "@/components/hakkiu-mark";

export const Route = createFileRoute("/auth/reset-password")({
  head: () => ({ meta: [{ title: "Set your password — HAKKIU" }] }),
  component: ResetPasswordPage,
});

type Phase = "checking" | "ready" | "invalid" | "done";

// Where an admin "invite / login link" (a Supabase recovery link) lands. Establishes the
// temporary session from the URL, then lets the customer choose their own password via
// updateUser(). Handles BOTH auth flows: PKCE (?code=) and implicit (#access_token in hash).
function ResetPasswordPage() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let settled = false;
    let unsub: (() => void) | undefined;

    async function init() {
      const { supabase } = await import("@/lib/supabase");
      if (!supabase) {
        setPhase("invalid");
        return;
      }

      // Implicit flow: detectSessionInUrl parses the hash and fires PASSWORD_RECOVERY / a session.
      const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === "PASSWORD_RECOVERY" || session) {
          settled = true;
          setPhase("ready");
        }
      });
      unsub = () => sub.subscription.unsubscribe();

      // PKCE flow: the link redirects here with ?code=… — exchange it for a session.
      const code = new URLSearchParams(window.location.search).get("code");
      if (code) {
        const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
        if (!exErr) {
          settled = true;
          setPhase("ready");
          return;
        }
      }

      // Fallback: maybe a session is already present.
      const { data } = await supabase.auth.getSession();
      if (!settled) setPhase(data.session ? "ready" : "invalid");
    }

    void init();
    return () => unsub?.();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    const { supabase } = await import("@/lib/supabase");
    if (!supabase) {
      setLoading(false);
      setError("Auth is not configured.");
      return;
    }
    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    setPhase("done");
    await supabase.auth.signOut();
    toast.success("Password set — sign in with your new password.");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-background p-6 shadow-sm">
        <div className="mb-4 flex flex-col items-center gap-2 text-center">
          <HakkiuMark className="h-12 w-12 text-primary" />
          <h1 className="text-lg font-semibold">Set your password</h1>
        </div>

        {phase === "checking" && (
          <p className="py-6 text-center text-sm text-muted-foreground">Verifying your link…</p>
        )}

        {phase === "invalid" && (
          <div className="space-y-4 text-center">
            <p className="text-sm text-destructive">
              This link is invalid or has expired. Ask HAKKIU to send you a new login link.
            </p>
            <button
              className="w-full rounded-md border border-border px-3 py-2 text-sm hover:bg-muted"
              onClick={() => navigate({ to: "/auth/sign-in", replace: true })}
            >
              Back to sign in
            </button>
          </div>
        )}

        {phase === "done" && (
          <div className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground">Your password is set. You can sign in now.</p>
            <button
              className="w-full rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:opacity-90"
              onClick={() => navigate({ to: "/auth/sign-in", replace: true })}
            >
              Go to sign in
            </button>
          </div>
        )}

        {phase === "ready" && (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="new-password" className="text-sm font-medium">New password</label>
              <input
                id="new-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="confirm-password" className="text-sm font-medium">Confirm password</label>
              <input
                id="confirm-password"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                required
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {loading ? "Setting…" : "Set password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
