import { useState, type CSSProperties, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ShieldCheck, MailCheck, Eye, EyeOff } from "lucide-react";
import { HakkiuLogo } from "@/components/hakkiu-logo";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import { InfringementMap } from "@/components/auth/infringement-map";

type Mode = "signin" | "signup";

const GENERIC_ERROR = "Something went wrong. Please try again later.";

// Staggered reveal helper — each block enters slightly after the previous.
function step(i: number): CSSProperties {
  return { animationDelay: `${i * 70}ms`, animationFillMode: "both" };
}

export function AuthScreen({ initialMode, redirect }: { initialMode: Mode; redirect?: string }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const isSignup = mode === "signup";

  function switchMode(next: Mode) {
    setMode(next);
    setSent(false);
    setPassword("");
    setConfirm("");
    setShowPassword(false);
    setShowConfirm(false);
  }

  async function onGoogle() {
    if (!supabase) return toast.error(GENERIC_ERROR);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) toast.error(error.message);
  }

  async function onForgot() {
    if (!supabase) return toast.error(GENERIC_ERROR);
    if (!email) return toast.error("Enter your email above, then click Forgot.");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback`,
    });
    if (error) return toast.error(error.message);
    toast.success(`Password reset link sent to ${email}.`);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!supabase) return toast.error(GENERIC_ERROR);

    if (isSignup) {
      if (password !== confirm) return toast.error("Passwords do not match.");
      setLoading(true);
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      setLoading(false);
      if (error) return toast.error(error.message);
      setSent(true);
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    navigate({ to: redirect ?? "/dashboard" });
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-background font-body-alt text-foreground">
      {/* Floating brand — left */}
      <Link to="/landing" className="absolute left-6 top-6 z-30 flex items-center gap-3 sm:left-10">
        <HakkiuLogo className="h-9 text-foreground" />
      </Link>

      {/* Floating back link — right */}
      <Button
        asChild
        variant="outline"
        className="absolute right-6 top-6 z-30 h-11 border-border/60 bg-background/50 px-5 text-sm text-muted-foreground backdrop-blur hover:bg-background/70 hover:text-foreground sm:right-10"
      >
        <Link to="/landing">← Back to landing</Link>
      </Button>

      <div className="grid flex-1 lg:grid-cols-[1.6fr_1fr]">
        {/* Left — live infringement map */}
        <div className="relative order-2 hidden lg:order-1 lg:block lg:h-auto">
          <InfringementMap />
        </div>

        {/* Right — form */}
        <div className="auth-grain relative order-1 flex flex-col justify-center overflow-hidden px-6 py-12 sm:px-10 lg:order-2 lg:px-16 xl:px-20">
          {/* Atmosphere: accent bloom + ghost shield watermark */}
          <div className="auth-drift pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-accent/20 blur-3xl" />
          <ShieldCheck
            className="pointer-events-none absolute -right-10 bottom-[-3rem] h-72 w-72 text-foreground/[0.025]"
            strokeWidth={0.75}
            aria-hidden="true"
          />

          <div className="relative z-10 mx-auto w-full max-w-md">
            {sent ? (
              <div className="duration-500 animate-in fade-in-0 zoom-in-95">
                <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/15 text-accent">
                  <span className="auth-ping-soft absolute inset-0 rounded-2xl bg-accent/30" />
                  <MailCheck className="relative h-7 w-7" />
                </div>
                <h1 className="font-display mt-6 text-center text-2xl font-semibold tracking-tight">
                  Check your email
                </h1>
                <p className="mt-2 text-center text-sm text-muted-foreground">
                  We sent a confirmation link to{" "}
                  <span className="font-medium text-foreground">{email}</span>. Click it to activate
                  your account, then sign in.
                </p>
                <Button
                  variant="outline"
                  className="mt-8 w-full"
                  onClick={() => switchMode("signin")}
                >
                  Back to sign in
                </Button>
              </div>
            ) : (
              <div key={mode} className="duration-500">
                <p
                  className="font-mono text-[0.7rem] uppercase tracking-[0.28em] text-accent duration-500 animate-in fade-in-0 slide-in-from-bottom-2"
                  style={step(0)}
                >
                  {isSignup ? "Start monitoring" : "Secure workspace access"}
                </p>
                <h1
                  className="font-display mt-3 text-4xl font-semibold tracking-tight text-foreground duration-500 animate-in fade-in-0 slide-in-from-bottom-2"
                  style={step(1)}
                >
                  {isSignup ? "Create your account" : "Welcome back"}
                </h1>
                <p
                  className="mt-2 text-sm text-muted-foreground duration-500 animate-in fade-in-0 slide-in-from-bottom-2"
                  style={step(2)}
                >
                  {isSignup
                    ? "Start protecting your brand in minutes."
                    : "Sign in to your workspace."}
                </p>

                <Button
                  type="button"
                  variant="outline"
                  className="mt-12 h-11 w-full gap-2 duration-500 animate-in fade-in-0 slide-in-from-bottom-2"
                  style={step(3)}
                  onClick={onGoogle}
                >
                  <GoogleIcon />
                  Continue with Google
                </Button>

                <div
                  className="my-6 flex items-center gap-3 duration-500 animate-in fade-in-0 slide-in-from-bottom-2"
                  style={step(4)}
                >
                  <span className="h-px flex-1 bg-border" />
                  <span className="font-mono text-[0.65rem] uppercase tracking-widest text-muted-foreground">
                    or
                  </span>
                  <span className="h-px flex-1 bg-border" />
                </div>

                <form onSubmit={onSubmit} className="space-y-5">
                  {isSignup && (
                    <div
                      className="space-y-2 duration-500 animate-in fade-in-0 slide-in-from-bottom-2"
                      style={step(5)}
                    >
                      <Label htmlFor="name">Full name</Label>
                      <Input
                        id="name"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Jane Doe"
                        className="h-11"
                      />
                    </div>
                  )}
                  <div
                    className="space-y-2 duration-500 animate-in fade-in-0 slide-in-from-bottom-2"
                    style={step(isSignup ? 6 : 5)}
                  >
                    <Label htmlFor="email">{isSignup ? "Work email" : "Email"}</Label>
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@company.com"
                      className="h-11"
                    />
                  </div>
                  <div
                    className="space-y-2 duration-500 animate-in fade-in-0 slide-in-from-bottom-2"
                    style={step(isSignup ? 7 : 6)}
                  >
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        autoComplete={isSignup ? "new-password" : "current-password"}
                        required
                        minLength={isSignup ? 8 : undefined}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="h-11 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {isSignup && (
                      <p className="text-xs text-muted-foreground">Minimum 8 characters.</p>
                    )}
                    {!isSignup && (
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={onForgot}
                          className="text-xs font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-accent hover:underline"
                        >
                          Forgot your password?
                        </button>
                      </div>
                    )}
                  </div>
                  {isSignup && (
                    <div
                      className="space-y-2 duration-500 animate-in fade-in-0 slide-in-from-bottom-2"
                      style={step(8)}
                    >
                      <Label htmlFor="confirm">Confirm password</Label>
                      <div className="relative">
                        <Input
                          id="confirm"
                          type={showConfirm ? "text" : "password"}
                          autoComplete="new-password"
                          required
                          minLength={8}
                          value={confirm}
                          onChange={(e) => setConfirm(e.target.value)}
                          className="h-11 pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirm((v) => !v)}
                          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
                          aria-label={showConfirm ? "Hide password" : "Show password"}
                        >
                          {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  )}
                  <Button
                    type="submit"
                    className="mt-1 h-11 w-full shadow-[0_0_24px_-6px] shadow-accent/50 duration-500 animate-in fade-in-0 slide-in-from-bottom-2"
                    style={step(isSignup ? 9 : 7)}
                    disabled={loading}
                  >
                    {loading
                      ? isSignup
                        ? "Creating account…"
                        : "Signing in…"
                      : isSignup
                        ? "Create account"
                        : "Sign in"}
                  </Button>
                </form>
              </div>
            )}

            <p className="mt-8 text-center text-sm text-muted-foreground">
              {isSignup ? "Already have an account? " : "New to HAKKIU? "}
              <button
                type="button"
                onClick={() => switchMode(isSignup ? "signin" : "signup")}
                className="font-semibold text-foreground transition-colors hover:text-accent"
              >
                {isSignup ? "Sign in" : "Create an account"}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.65l-3.57-2.77c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}
