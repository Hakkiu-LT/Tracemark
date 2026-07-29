import { createClient } from "@supabase/supabase-js";

// Staff authenticate against the SAME Supabase project as customers, but the admin app
// runs on its own origin (admin.hakkiu.com) and uses a distinct storageKey so its
// session never collides with a customer session in the same browser.
const url = import.meta.env.VITE_SUPABASE_URL as string;
const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

// Session persistence uses Supabase's default localStorage. A previous custom
// single-cookie storage broke auth: a full Supabase session exceeds the browser's
// ~4 KB single-cookie limit, so the cookie was silently dropped and getSession()
// could not restore the token (API calls went out with no Authorization header).
export const supabase = createClient(url, anonKey, {
  auth: {
    storageKey: "tracemark-admin-auth",
    persistSession: true,
    autoRefreshToken: true,
  },
});
