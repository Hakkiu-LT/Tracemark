-- Staff accounts: one row per employee who may access the admin portal.
--
-- Staff share this project's auth.users with customers; a row here is what marks an
-- auth user as staff (and grants admin-portal access). The admin backend authenticates
-- the normal Supabase JWT and then checks for a matching, active staff_accounts row.
--
-- `role` is only a TEMPLATE that seeds a default set of permissions (see
-- staff_permissions). Effective authority = role preset + per-staff overrides.
--
-- Note: the existing handle_new_user trigger will also create a public.profiles row
-- for a staff auth user. That's harmless (staff simply don't use the customer app);
-- treat staff-vs-customer purely by the presence of a staff_accounts row.

CREATE TABLE IF NOT EXISTS public.staff_accounts (
    id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email           TEXT NOT NULL,
    full_name       TEXT,
    role            TEXT NOT NULL DEFAULT 'sales',   -- 'dev' | 'sales' | 'marketing' | 'admin'
    is_super_admin  BOOLEAN NOT NULL DEFAULT false,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_by      UUID,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT staff_accounts_role_check
        CHECK (role IN ('dev', 'sales', 'marketing', 'admin'))
);

CREATE INDEX IF NOT EXISTS staff_accounts_active_idx
    ON public.staff_accounts (is_active);

-- Reuse the existing update_updated_at() trigger function (defined in week2_schema).
DROP TRIGGER IF EXISTS staff_accounts_updated_at ON public.staff_accounts;
CREATE TRIGGER staff_accounts_updated_at
    BEFORE UPDATE ON public.staff_accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS: enabled. Admin backend uses the service-role key (bypasses RLS) for all reads.
-- A staff member may read only their own row (client-side /staff/me fallback).
ALTER TABLE public.staff_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff can read own row" ON public.staff_accounts;
CREATE POLICY "staff can read own row" ON public.staff_accounts
    FOR SELECT USING (auth.uid() = id);
