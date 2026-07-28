import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label } from "@/components/ui";
import { HakkiuMark } from "@/components/HakkiuMark";

type Phase = "checking" | "ready" | "invalid" | "done";

export function ResetPassword() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // The recovery link opens this page with a token in the URL hash. The Supabase
  // client (detectSessionInUrl, default on) exchanges it for a temporary session
  // and fires a PASSWORD_RECOVERY event. We accept either that event or an already
  // established session, then let the staffer set a new password via updateUser().
  useEffect(() => {
    let settled = false;

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) {
        settled = true;
        setPhase("ready");
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (settled) return;
      setPhase(data.session ? "ready" : "invalid");
    });

    return () => sub.subscription.unsubscribe();
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
    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    setPhase("done");
    // Clear the recovery session so the staffer signs in cleanly with the new password.
    await supabase.auth.signOut();
    toast.success("Password updated — sign in with your new password.");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <HakkiuMark className="mb-2 h-14 w-14 text-accent" />
          <CardTitle>HAKKIU Admin</CardTitle>
          <CardDescription>Set a new password</CardDescription>
        </CardHeader>
        <CardContent>
          {phase === "checking" && (
            <div className="flex justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {phase === "invalid" && (
            <div className="space-y-4 text-center">
              <p className="text-sm text-destructive">
                This reset link is invalid or has expired. Request a new one from the sign-in page.
              </p>
              <Button variant="outline" className="w-full" onClick={() => navigate({ to: "/auth/sign-in" })}>
                Back to sign in
              </Button>
            </div>
          )}

          {phase === "done" && (
            <div className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">
                Your password has been updated. You can now sign in with your new password.
              </p>
              <Button className="w-full" onClick={() => navigate({ to: "/auth/sign-in" })}>
                Go to sign in
              </Button>
            </div>
          )}

          {phase === "ready" && (
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="new-password">New password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm-password">Confirm password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Update password
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
