-- ═════════════════════════════════════════════════════════════════════════════
-- P0 security remediation (2026-07-28 re-audit)
-- See security-remediation-plan-2026-07-28.md
--
-- Closes three CRITICAL cross-tenant holes that post-date the 20260714000001
-- hardening pass, plus one SECURITY DEFINER hardening item:
--   C2  profiles.organization_id was mutable by the user → org-spoofing → the
--       linchpin cross-tenant read (every policy scopes by p.organization_id).
--   C3  evidence_items had FOR ALL USING (auth.role()='authenticated') → any
--       logged-in user could read/write every org's detection evidence.
--   C4  brand_assets had the same broad policy → cross-tenant brand assets +
--       storage paths.
--   L4  user_is_org_member() SECURITY DEFINER lacked a fixed search_path.
--
-- SAFE to apply: evidence_items / brand_assets are written by the service-role
-- backend (which bypasses RLS) and are NOT read from the browser with the anon
-- key, so scoping them cannot break the customer app. profiles.organization_id
-- is only ever set by the backend at signup/invite (the frontend updates only
-- full_name), so freezing it does not break any client flow.
--
-- DEFERRED to a follow-up (documented, needs frontend-access verification first
-- so we don't break legit access): H4 (add explicit WITH CHECK to the persona
-- mode-isolation policies) and H7 (drop the `organization_id = auth.uid()`
-- branch from the brands SELECT policy — some brands may have a null user_id and
-- rely on it for owner visibility). C2 below already removes the main write-side
-- exploit path that H4 was worried about.
-- ═════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- C2: freeze profiles.organization_id (org-spoofing → cross-tenant read)
-- ─────────────────────────────────────────────────────────────────────────────
-- Defense in depth #1: the authenticated/anon roles may not write this column.
REVOKE UPDATE (organization_id) ON public.profiles FROM authenticated;
REVOKE UPDATE (organization_id) ON public.profiles FROM anon;

-- Defense in depth #2: extend the existing protect trigger so any change to
-- organization_id (or is_admin/plan) is reverted unless the writer is the
-- service role. Only service-role backend code (signup/invite) may set the org.
CREATE OR REPLACE FUNCTION public.protect_privileged_profile_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF COALESCE(auth.role(), '') IS DISTINCT FROM 'service_role' THEN
    NEW.is_admin        := OLD.is_admin;
    NEW.plan            := OLD.plan;
    NEW.organization_id := OLD.organization_id;
  END IF;
  RETURN NEW;
END;
$$;
-- (trigger trg_protect_privileged_profile_columns already bound in 20260714000001)

-- ─────────────────────────────────────────────────────────────────────────────
-- C3: org/user-scope evidence_items (was FOR ALL USING authenticated)
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "evidence_items_authenticated" ON public.evidence_items;
DROP POLICY IF EXISTS "evidence_items_org_or_user"   ON public.evidence_items;
CREATE POLICY "evidence_items_org_or_user" ON public.evidence_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.cases c
      LEFT JOIN public.profiles p ON p.id = auth.uid()
      WHERE c.id = evidence_items.case_id
        AND (
          (p.organization_id IS NOT NULL AND c.organization_id = p.organization_id)
          OR c.user_id = auth.uid()
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.cases c
      LEFT JOIN public.profiles p ON p.id = auth.uid()
      WHERE c.id = evidence_items.case_id
        AND (
          (p.organization_id IS NOT NULL AND c.organization_id = p.organization_id)
          OR c.user_id = auth.uid()
        )
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- C4: org/user-scope brand_assets (was FOR ALL USING authenticated)
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "brand_assets_authenticated" ON public.brand_assets;
DROP POLICY IF EXISTS "brand_assets_org_or_user"   ON public.brand_assets;
CREATE POLICY "brand_assets_org_or_user" ON public.brand_assets
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.brands b
      LEFT JOIN public.profiles p ON p.id = auth.uid()
      WHERE b.id = brand_assets.brand_id
        AND (
          b.user_id = auth.uid()
          OR (p.organization_id IS NOT NULL AND b.organization_id = p.organization_id)
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.brands b
      LEFT JOIN public.profiles p ON p.id = auth.uid()
      WHERE b.id = brand_assets.brand_id
        AND (
          b.user_id = auth.uid()
          OR (p.organization_id IS NOT NULL AND b.organization_id = p.organization_id)
        )
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- L4: fix the SECURITY DEFINER helper's search_path
-- ─────────────────────────────────────────────────────────────────────────────
ALTER FUNCTION public.user_is_org_member(uuid) SET search_path = public, pg_temp;
