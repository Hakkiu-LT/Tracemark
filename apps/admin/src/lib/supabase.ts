import { createClient } from "@supabase/supabase-js";

// Staff authenticate against the SAME Supabase project as customers, but the admin app
// runs on its own origin (admin.tracemark.ai) and uses a distinct storageKey so its
// session never collides with a customer session in the same browser.
const url = import.meta.env.VITE_SUPABASE_URL as string;
const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

// Secure cookie storage: moves auth tokens from localStorage to cookies with
// Secure + SameSite=Strict flags.
const secureCookieStorage = {
  getItem: (key: string): string | null => {
    if (typeof document === "undefined") return null;
    const encoded = encodeURIComponent(key).replace(/[+.*]/g, "\\$&");
    const match = document.cookie.match(new RegExp(`(?:^|; )${encoded}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : null;
  },
  setItem: (key: string, value: string): void => {
    if (typeof document === "undefined") return;
    document.cookie = `${encodeURIComponent(key)}=${encodeURIComponent(value)}; path=/; max-age=604800; Secure; SameSite=Strict`;
  },
  removeItem: (key: string): void => {
    if (typeof document === "undefined") return;
    document.cookie = `${encodeURIComponent(key)}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; Secure; SameSite=Strict`;
  },
};

export const supabase = createClient(url, anonKey, {
  auth: {
    storageKey: "tracemark-admin-auth",
    storage: secureCookieStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});
