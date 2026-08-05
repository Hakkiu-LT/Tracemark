import { useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import HCaptcha from "@hcaptcha/react-hcaptcha";

import { supabase } from "@/lib/supabase";
import { adminFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label } from "@/components/ui";
import { HakkiuMark } from "@/components/HakkiuMark";

type Mode = "signin" | "forgot";

// hCaptcha SITE key (browser-safe). When set, staff sign-in requires a solved CAPTCHA
// before the password is sent to Supabase — this is the anti-brute-force gate, since
// login goes browser -> Supabase directly and never passes through our backend where a
// rate limiter could sit. Leave the env var blank in local dev to skip the widget.
const HCAPTCHA_SITE_KEY = import.meta.env.VITE_HCAPTCHA_SITE_KEY as string | undefined;

export function SignIn() {
  const navigate = useNavigate();
  const { notStaff, signOut } = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const captchaRef = useRef<HCaptcha>(null);

  // Invisible hCaptcha: no visible box. execute({ async: true }) runs the challenge on
  // demand at submit and resolves to a fresh single-use token (throws if closed/failed).
  // Returns undefined when the site key is unset (local dev without CAPTCHA).
  async function getCaptchaToken(): Promise<string | undefined> {
    if (!HCAPTCHA_SITE_KEY) return undefined;
    const result = await captchaRef.current?.execute({ async: true });
    return result?.response;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const captchaToken = await getCaptchaToken();
      const { error: err } = await supabase.auth.signInWithPassword({
        email,
        password,
        options: captchaToken ? { captchaToken } : undefined,
      });
      if (err) {
        setError(err.message);
        return;
      }
      navigate({ to: "/dashboard" });
    } catch {
      setError("Couldn't verify you're human. Please try again.");
    } finally {
      // Single-use token — reset so the next attempt gets a fresh one.
      captchaRef.current?.resetCaptcha();
      setLoading(false);
    }
  }

  async function onForgot(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    // Reset goes through the admin API, which generates the recovery link and mails
    // it via our own Resend pipeline (NOT Supabase's built-in SMTP). The endpoint
    // always returns a neutral response, so a 2xx here just means "request accepted".
    try {
      await adminFetch("/staff/request-password-reset", {
        method: "POST",
        body: JSON.stringify({ email, origin: window.location.origin }),
      });
      // Always show the same confirmation — never reveal whether the email exists.
      setResetSent(true);
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : "Couldn't send the reset email right now. Please try again in a moment.",
      );
    } finally {
      setLoading(false);
    }
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
              <div className="rounded bg-destructive/10 p-3 text-sm text-destructive">
                {typeof notStaff === "string" ? notStaff : "This account is not authorized for the admin portal."}
              </div>
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
              {/* Invisible hCaptcha — no visible box; triggered by execute() in onSubmit. */}
              {HCAPTCHA_SITE_KEY && (
                <HCaptcha ref={captchaRef} sitekey={HCAPTCHA_SITE_KEY} size="invisible" />
              )}
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
