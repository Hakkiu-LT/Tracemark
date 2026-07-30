import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import type { Profile } from "./supabase";
import { useStore } from "./store";

// The Supabase client (@supabase/*, ~60 KiB gzip) is imported DYNAMICALLY, not
// statically, so it is code-split into its own async chunk instead of riding in
// the initial/root bundle that EVERY page (incl. the public landing) downloads
// and hydrates. AuthProvider still runs its session check on mount exactly as
// before — the import just resolves right after hydration, off the render path.
// The dynamic import() is module-cached, so repeated calls reuse one download.

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  /** True until the initial session lookup completes. */
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({
  children,
  /**
   * True when the current route is a public MARKETING/legal page that never
   * reads auth state (everything outside the `RequireAuth` app shell, and not an
   * auth flow). When true, AuthProvider does NOT import the Supabase client — so
   * the landing/marketing pages stop downloading the ~55 KiB @supabase chunk.
   * It "activates" (loads supabase + checks the session) the moment the user is
   * on a route that actually needs auth, and stays activated thereafter.
   */
  deferAuth = false,
}: {
  children: ReactNode;
  deferAuth?: boolean;
}) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  // `loading` stays initially `true` (as before) so RequireAuth — which only
  // ever mounts on non-public routes (where deferAuth is false) — can never
  // observe loading=false before a session check has completed. This is what
  // prevents a logged-in user from being wrongly bounced to sign-in when
  // navigating from a marketing page into the app.
  const [loading, setLoading] = useState(true);
  const [activated, setActivated] = useState(!deferAuth);

  // Activate DURING RENDER (not in an effect) the moment we're on a route that
  // needs auth, and re-enter the loading state synchronously — so RequireAuth
  // mounts seeing loading=true (spinner), never a premature redirect. Guarded,
  // so it runs once on the marketing→app transition and never loops.
  if (!activated && !deferAuth) {
    setActivated(true);
    setLoading(true);
  }

  useEffect(() => {
    if (!activated) {
      // Public marketing/legal page: no auth consumer, so skip loading supabase.
      setLoading(false);
      return;
    }

    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    setLoading(true);

    import("./supabase").then(({ supabase }) => {
      if (cancelled) return;
      if (!supabase) {
        setLoading(false);
        return;
      }

      supabase.auth.getSession().then(({ data }) => {
        if (cancelled) return;
        setSession(data.session);
        setLoading(false);
      });

      const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
        setSession(next);
      });
      unsubscribe = () => sub.subscription.unsubscribe();
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [activated]);

  // Keep the profile row in sync with the signed-in user.
  useEffect(() => {
    const userId = session?.user.id;
    if (!userId) {
      setProfile(null);
      return;
    }
    let cancelled = false;
    import("./supabase").then(async ({ supabase, fetchProfile }) => {
      const p = await fetchProfile(userId);
      if (cancelled) return;
      setProfile(p);

      // Load persona from org_settings if available
      if (p && supabase) {
        const orgId = p.organization_id || userId;
        try {
          const { data, error } = await supabase
            .from("org_settings")
            .select("persona")
            .eq("organization_id", orgId)
            .maybeSingle();
          if (!cancelled && !error && data?.persona) {
            useStore.getState().setPersona(data.persona as any);
          }
        } catch (err) {
          console.warn("Failed to load persona from Supabase:", err);
        }
      }
    });
    return () => {
      cancelled = true;
    };
  }, [session?.user.id]);

  async function signOut() {
    const { supabase } = await import("./supabase");
    await supabase?.auth.signOut();
    setSession(null);
    setProfile(null);
  }

  async function refreshProfile() {
    const userId = session?.user.id;
    if (userId) {
      const { fetchProfile } = await import("./supabase");
      const p = await fetchProfile(userId);
      setProfile(p);
    }
  }

  return (
    <AuthContext.Provider
      value={{ session, user: session?.user ?? null, profile, loading, signOut, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an <AuthProvider>");
  return ctx;
}

/**
 * Wraps protected routes. Redirects unauthenticated users to the sign-in page,
 * preserving where they were headed via the `redirect` search param.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!loading && !session) {
      navigate({ to: "/auth/sign-in", search: { redirect: pathname }, replace: true });
    }
  }, [loading, session, navigate, pathname]);

  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <span className="text-sm text-muted-foreground">Loading…</span>
      </div>
    );
  }

  return <>{children}</>;
}
