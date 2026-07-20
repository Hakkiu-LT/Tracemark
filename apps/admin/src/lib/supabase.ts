import { createClient } from "@supabase/supabase-js";

// Staff authenticate against the SAME Supabase project as customers, but the admin app
// runs on its own origin (admin.tracemark.ai) and uses a distinct storageKey so its
// session never collides with a customer session in the same browser.
const url = import.meta.env.VITE_SUPABASE_URL as string;
const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export const supabase = createClient(url, anonKey, {
  auth: {
    storageKey: "tracemark-admin-auth",
    persistSession: true,
    autoRefreshToken: true,
  },
});
