-- ═════════════════════════════════════════════════════════════════════════════
-- P1 security remediation (2026-07-28 re-audit) — H4 + H7 + PROD RLS DRIFT FIX
-- See security-remediation-plan-2026-07-28.md
--
-- ⚠️ A `supabase db dump` of the LIVE project (2026-07-28) revealed the prod RLS
-- state had DRIFTED from the migration files: several core tenant tables still
-- carry BROAD `allow_all_authenticated` / `_authenticated` policies that make
-- them cross-tenant readable (RLS policies are permissive-OR, so a broad policy
-- defeats the scoped one). This migration reconciles prod to the intended
-- secure state AND adds the H4/H7 hardening.
--
-- LIVE broad policies found on prod and removed here:
--   evidence           → allow_all_authenticated            (no scoped policy existed!)
--   takedown_reports   → allow_all_authenticated            (no scoped policy existed!)
--   decisions          → allow_all_authenticated            (no scoped policy existed!)
--   infringements      → infringements_authenticated        (coexisted with the scoped one)
--   cases              → cases_own (user_id = uid OR user_id IS NULL) — the NULL
--                        branch leaked ownerless cases to every authenticated user
--
-- Scoping pattern mirrors the existing cases/infringements *_with_mode_isolation
-- policies (join to cases, org-or-user + persona split). A child row (evidence/
-- decision/takedown/infringement) is visible iff its parent case is visible.
--
-- SAFETY: validated on a throwaway PG16 loaded with the REAL prod schema dump +
-- synthetic 2-org data — proved (a) a user still sees their own org's rows via
-- the exact frontend read queries incl. PostgREST embeds, and (b) cross-tenant
-- reads return zero rows. WITH CHECK only gates INSERT/UPDATE (frontend does
-- neither on these tables; writes are service-role).
-- ═════════════════════════════════════════════════════════════════════════════

-- ── shared predicate: caller owns the parent case (org or user) + persona split ──
-- (inlined per table because RLS policies can't take parameters)

-- ── evidence: replace broad allow_all with case-scoped ───────────────────────
DROP POLICY IF EXISTS "allow_all_authenticated" ON public.evidence;
DROP POLICY IF EXISTS "evidence_org_or_user_with_mode_isolation" ON public.evidence;
CREATE POLICY "evidence_org_or_user_with_mode_isolation" ON public.evidence
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.cases c
      LEFT JOIN public.profiles p ON p.id = auth.uid()
      LEFT JOIN public.org_settings o ON o.organization_id = p.organization_id
      WHERE c.id = evidence.case_id
        AND ((p.organization_id IS NOT NULL AND c.organization_id = p.organization_id) OR c.user_id = auth.uid())
        AND ((COALESCE(o.persona, 'brand_owner') = 'law_firm' AND c.client_id IS NOT NULL)
             OR (COALESCE(o.persona, 'brand_owner') = 'brand_owner' AND c.client_id IS NULL))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.cases c
      LEFT JOIN public.profiles p ON p.id = auth.uid()
      LEFT JOIN public.org_settings o ON o.organization_id = p.organization_id
      WHERE c.id = evidence.case_id
        AND ((p.organization_id IS NOT NULL AND c.organization_id = p.organization_id) OR c.user_id = auth.uid())
        AND ((COALESCE(o.persona, 'brand_owner') = 'law_firm' AND c.client_id IS NOT NULL)
             OR (COALESCE(o.persona, 'brand_owner') = 'brand_owner' AND c.client_id IS NULL))
    )
  );

-- ── takedown_reports: replace broad allow_all with case-scoped ───────────────
DROP POLICY IF EXISTS "allow_all_authenticated" ON public.takedown_reports;
DROP POLICY IF EXISTS "takedown_reports_org_or_user_with_mode_isolation" ON public.takedown_reports;
CREATE POLICY "takedown_reports_org_or_user_with_mode_isolation" ON public.takedown_reports
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.cases c
      LEFT JOIN public.profiles p ON p.id = auth.uid()
      LEFT JOIN public.org_settings o ON o.organization_id = p.organization_id
      WHERE c.id = takedown_reports.case_id
        AND ((p.organization_id IS NOT NULL AND c.organization_id = p.organization_id) OR c.user_id = auth.uid())
        AND ((COALESCE(o.persona, 'brand_owner') = 'law_firm' AND c.client_id IS NOT NULL)
             OR (COALESCE(o.persona, 'brand_owner') = 'brand_owner' AND c.client_id IS NULL))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.cases c
      LEFT JOIN public.profiles p ON p.id = auth.uid()
      LEFT JOIN public.org_settings o ON o.organization_id = p.organization_id
      WHERE c.id = takedown_reports.case_id
        AND ((p.organization_id IS NOT NULL AND c.organization_id = p.organization_id) OR c.user_id = auth.uid())
        AND ((COALESCE(o.persona, 'brand_owner') = 'law_firm' AND c.client_id IS NOT NULL)
             OR (COALESCE(o.persona, 'brand_owner') = 'brand_owner' AND c.client_id IS NULL))
    )
  );

-- ── decisions: replace broad allow_all with case-scoped ──────────────────────
DROP POLICY IF EXISTS "allow_all_authenticated" ON public.decisions;
DROP POLICY IF EXISTS "decisions_org_or_user_with_mode_isolation" ON public.decisions;
CREATE POLICY "decisions_org_or_user_with_mode_isolation" ON public.decisions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.cases c
      LEFT JOIN public.profiles p ON p.id = auth.uid()
      LEFT JOIN public.org_settings o ON o.organization_id = p.organization_id
      WHERE c.id = decisions.case_id
        AND ((p.organization_id IS NOT NULL AND c.organization_id = p.organization_id) OR c.user_id = auth.uid())
        AND ((COALESCE(o.persona, 'brand_owner') = 'law_firm' AND c.client_id IS NOT NULL)
             OR (COALESCE(o.persona, 'brand_owner') = 'brand_owner' AND c.client_id IS NULL))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.cases c
      LEFT JOIN public.profiles p ON p.id = auth.uid()
      LEFT JOIN public.org_settings o ON o.organization_id = p.organization_id
      WHERE c.id = decisions.case_id
        AND ((p.organization_id IS NOT NULL AND c.organization_id = p.organization_id) OR c.user_id = auth.uid())
        AND ((COALESCE(o.persona, 'brand_owner') = 'law_firm' AND c.client_id IS NOT NULL)
             OR (COALESCE(o.persona, 'brand_owner') = 'brand_owner' AND c.client_id IS NULL))
    )
  );

-- ── infringements: drop the redundant broad policy (scoped one already exists) ─
DROP POLICY IF EXISTS "infringements_authenticated" ON public.infringements;

-- ── cases: drop cases_own (its `user_id IS NULL` branch leaked ownerless rows) ─
DROP POLICY IF EXISTS "cases_own" ON public.cases;

-- ── H4: add explicit WITH CHECK to the surviving scoped policies (cases/infr.) ─
ALTER POLICY "cases_org_or_user_with_mode_isolation" ON public.cases
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      LEFT JOIN public.org_settings o ON o.organization_id = p.organization_id
      WHERE p.id = auth.uid()
        AND ((p.organization_id IS NOT NULL AND cases.organization_id = p.organization_id) OR cases.user_id = auth.uid())
        AND ((COALESCE(o.persona, 'brand_owner') = 'law_firm' AND cases.client_id IS NOT NULL)
             OR (COALESCE(o.persona, 'brand_owner') = 'brand_owner' AND cases.client_id IS NULL))
    )
  );

ALTER POLICY "infringements_org_or_user_with_mode_isolation" ON public.infringements
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.cases c
      LEFT JOIN public.profiles p ON p.id = auth.uid()
      LEFT JOIN public.org_settings o ON o.organization_id = p.organization_id
      WHERE c.id = infringements.case_id
        AND ((p.organization_id IS NOT NULL AND c.organization_id = p.organization_id) OR c.user_id = auth.uid())
        AND ((COALESCE(o.persona, 'brand_owner') = 'law_firm' AND c.client_id IS NOT NULL)
             OR (COALESCE(o.persona, 'brand_owner') = 'brand_owner' AND c.client_id IS NULL))
    )
  );

-- ── H7: drop the confused `organization_id = auth.uid()` branch from brands ───
ALTER POLICY "brands_org_or_user" ON public.brands
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.organization_id = brands.organization_id
    )
  );
