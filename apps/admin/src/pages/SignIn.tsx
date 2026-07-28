import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2 } from "lucide-react";

import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label } from "@/components/ui";
import { HakkiuMark } from "@/components/HakkiuMark";

type Mode = "signin" | "forgot";

export function SignIn() {
  const navigate = useNavigate();
  const { notStaff, signOut } = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    navigate({ to: "/dashboard" });
  }

  async function onForgot(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    // Supabase emails a recovery link that lands back on our /auth/reset-password
    // page (same admin origin), where the staffer sets a new password.
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    // Always show the same confirmation — never reveal whether the email exists.
    setResetSent(true);
  }

  function backToSignIn() {
    setMode("signin");
    setError(null);
    setResetSent(false);
    setPassword("");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <HakkiuMark className="mb-2 h-14 w-14 text-accent" />
          <CardTitle>HAKKIU Admin</CardTitle>
          <CardDescription>
            {mode === "forgot" ? "Reset your password" : "Staff sign-in only"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {notStaff ? (
            <div className="space-y-4 text-center">
              <p className="text-sm text-destructive">
                This account is not authorized for the admin portal.
              </p>
              <Button variant="outline" className="w-full" onClick={() => signOut()}>
                Sign out
              </Button>
            </div>
          ) : mode === "forgot" ? (
            resetSent ? (
              <div className="space-y-4 text-center">
                <p className="text-sm text-muted-foreground">
                  If an account exists for <span className="font-medium">{email}</span>, a
                  password reset link is on its way. Check your inbox.
                </p>
                <Button variant="outline" className="w-full" onClick={backToSignIn}>
                  Back to sign in
                </Button>
              </div>
            ) : (
              <form onSubmit={onForgot} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="reset-email">Email</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Send reset link
                </Button>
                <button
                  type="button"
                  onClick={backToSignIn}
                  className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
                >
                  Back to sign in
                </button>
              </form>
            )
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Sign in
              </Button>
              <button
                type="button"
                onClick={() => {
                  setMode("forgot");
                  setError(null);
                }}
                className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
              >
                Forgot password?
              </button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
