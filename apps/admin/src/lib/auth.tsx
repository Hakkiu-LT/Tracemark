import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";

import { supabase } from "./supabase";
import { adminFetch } from "./api";
import type { Permission } from "./permissions";

export interface StaffProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  is_super_admin: boolean;
  permissions: string[];
}

interface AuthState {
  session: Session | null;
  user: User | null;
  staff: StaffProfile | null;
  permissions: Set<string>;
  loading: boolean;
  /** True when authenticated but NOT a valid staff account (login blocked). */
  notStaff: boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [staff, setStaff] = useState<StaffProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notStaff, setNotStaff] = useState(false);

  async function loadStaff(activeSession: Session | null) {
    if (!activeSession) {
      setStaff(null);
      setNotStaff(false);
      return;
    }
    try {
      const me = await adminFetch<StaffProfile>("/staff/me");
      setStaff(me);
      setNotStaff(false);
    } catch {
      // Authenticated with Supabase but not an active staff account (403).
      setStaff(null);
      setNotStaff(true);
    }
  }

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setUser(data.session?.user ?? null);
      await loadStaff(data.session);
      if (mounted) setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      await loadStaff(newSession);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value: AuthState = {
    session,
    user,
    staff,
    permissions: new Set(staff?.permissions ?? []),
    loading,
    notStaff,
    signOut: async () => {
      await supabase.auth.signOut();
      setStaff(null);
      setNotStaff(false);
    },
    refresh: async () => {
      const { data } = await supabase.auth.getSession();
      await loadStaff(data.session);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function usePermission(permission: Permission): boolean {
  const { staff, permissions } = useAuth();
  return !!staff?.is_super_admin || permissions.has(permission);
}
