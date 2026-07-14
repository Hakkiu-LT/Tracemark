-- Security hardening migration.
--
-- Fixes found in the July 2026 security audit:
--   C1  Privilege escalation: a user could set their own profiles.is_admin /
--       profiles.plan (the "profiles_own" policy is FOR ALL with no WITH CHECK).
--   C5  Cross-tenant leaks: documents / org_settings / notification_deliveries /
--       api_usage_records still used the broad `auth.role() = 'authenticated'`
--       policy, so any logged-in user could read/write every tenant's rows.
--   H2  handle_new_user() inserted into a non-existent `username` column and had
--       no fixed search_path (SECURITY DEFINER injection surface).
--
-- The backend talks to Postgres with the service-role key, which BYPASSES RLS,
-- so none of these policy tightenings affect the API. They only constrain
-- direct (anon-key) access from the browser, which is exactly the surface that
-- was exposed. The frontend's own-org access continues to work.
--
-- Idempotent: safe to re-run.

-- ─────────────────────────────────────────────────────────────────────────────
-- C1: lock the privileged profile columns (is_admin, plan)
-- ─────────────────────────────────────────────────────────────────────────────
-- Defense in depth #1: the `authenticated` role may not write these columns at
-- all. The frontend only ever updates full_name, so this does not break it.
REVOKE UPDATE (is_admin, plan) ON public.profiles FROM authenticated;
REVOKE UPDATE (is_admin, plan) ON public.profiles FROM anon;

-- Defense in depth #2: a trigger that reverts any change to these columns unless
-- the writer is the service role (used by the backend admin endpoints). This
-- also protects against a future policy accidentally re-opening writes.
CREATE OR REPLACE FUNCTION public.protect_privileged_profile_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF COALESCE(auth.role(), '') IS DISTINCT FROM 'service_role' THEN
    NEW.is_admin := OLD.is_admin;
    NEW.plan := OLD.plan;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_privileged_profile_columns ON public.profiles;
CREATE TRIGGER trg_protect_privileged_profile_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_privileged_profile_columns();

-- ─────────────────────────────────────────────────────────────────────────────
-- H2: fix handle_new_user() — correct columns + fixed search_path
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, NULLIF(NEW.raw_user_meta_data->>'full_name', ''))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- C5: org/user-scope the tables still using the broad authenticated policy
-- ─────────────────────────────────────────────────────────────────────────────

-- documents → infringements → cases → org/user (frontend inserts + reads these)
DROP POLICY IF EXISTS "Authenticated users can manage documents" ON public.documents;
DROP POLICY IF EXISTS "documents_org_or_user" ON public.documents;
CREATE POLICY "documents_org_or_user" ON public.documents
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.infringements i
      JOIN public.cases c ON c.id = i.case_id
      LEFT JOIN public.profiles p ON p.id = auth.uid()
      WHERE i.id = documents.infringement_id
        AND (
          (p.organization_id IS NOT NULL AND c.organization_id = p.organization_id)
          OR c.user_id = auth.uid()
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.infringements i
      JOIN public.cases c ON c.id = i.case_id
      LEFT JOIN public.profiles p ON p.id = auth.uid()
      WHERE i.id = documents.infringement_id
        AND (
          (p.organization_id IS NOT NULL AND c.organization_id = p.organization_id)
          OR c.user_id = auth.uid()
        )
    )
  );

-- notification_deliveries → infringements → cases → org/user (frontend reads)
DROP POLICY IF EXISTS "Authenticated users can manage notification deliveries" ON public.notification_deliveries;
DROP POLICY IF EXISTS "notification_deliveries_org_or_user" ON public.notification_deliveries;
CREATE POLICY "notification_deliveries_org_or_user" ON public.notification_deliveries
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.infringements i
      JOIN public.cases c ON c.id = i.case_id
      LEFT JOIN public.profiles p ON p.id = auth.uid()
      WHERE i.id = notification_deliveries.infringement_id
        AND (
          (p.organization_id IS NOT NULL AND c.organization_id = p.organization_id)
          OR c.user_id = auth.uid()
        )
    )
  );

-- org_settings keyed by organization_id (frontend reads + upserts its own org)
DROP POLICY IF EXISTS "allow_all_authenticated" ON public.org_settings;
DROP POLICY IF EXISTS "org_settings_own_org" ON public.org_settings;
CREATE POLICY "org_settings_own_org" ON public.org_settings
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.organization_id IS NOT NULL
        AND org_settings.organization_id = p.organization_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.organization_id IS NOT NULL
        AND org_settings.organization_id = p.organization_id
    )
  );

-- api_usage_records has no tenant column and is never touched by the browser;
-- restrict it to the service role by removing the authenticated policy. With RLS
-- enabled and no policy, `authenticated`/`anon` are denied; service_role bypasses.
DROP POLICY IF EXISTS "allow_all_authenticated" ON public.api_usage_records;
