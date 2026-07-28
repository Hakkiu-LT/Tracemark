-- ═════════════════════════════════════════════════════════════════════════════
-- P1 security remediation (2026-07-28 re-audit) — H4 + H7
-- See security-remediation-plan-2026-07-28.md
--
--   H4  The persona mode-isolation policies on cases/infringements/evidence/
--       takedown_reports were FOR ALL USING (...) with NO explicit WITH CHECK,
--       so an anon INSERT/UPDATE was governed only by USING. Add an explicit
--       WITH CHECK mirroring USING so writes can't attach a row to another org
--       or dodge the brand_owner/law_firm split.
--   H7  The brands SELECT policy had a confused `organization_id = auth.uid()`
--       branch (user-id treated as org-id). Remove it.
--
-- SAFETY (verified by reading code):
--   * The customer frontend (src/lib/supabase.ts) only does SELECT + DELETE on
--     cases/infringements/evidence/takedown_reports — it never INSERTs/UPDATEs
--     them via the anon key (all writes go through the service-role backend,
--     which bypasses RLS). WITH CHECK only gates INSERT/UPDATE, so H4 cannot
--     reject any real frontend traffic.
--   * We use ALTER POLICY ... WITH CHECK, which leaves each policy's USING
--     (read/delete) clause 100% untouched — so H4 has zero risk of hiding rows.
--   * H7: the only brands-insert path (apps/api/.../routes/brands.py:create_brand)
--     ALWAYS sets user_id = profile.id, so no brand relies on the dropped branch;
--     single-member orgs (organizations.id = user uid) stay covered by
--     `user_id = auth.uid()`.
-- ═════════════════════════════════════════════════════════════════════════════

-- ── H4: add WITH CHECK (mirrors each existing USING clause) ───────────────────

ALTER POLICY "cases_org_or_user_with_mode_isolation" ON public.cases
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      LEFT JOIN public.org_settings o ON o.organization_id = p.organization_id
      WHERE p.id = auth.uid()
        AND (
          (p.organization_id IS NOT NULL AND cases.organization_id = p.organization_id)
          OR cases.user_id = auth.uid()
        )
        AND (
          (COALESCE(o.persona, 'brand_owner') = 'law_firm' AND cases.client_id IS NOT NULL)
          OR (COALESCE(o.persona, 'brand_owner') = 'brand_owner' AND cases.client_id IS NULL)
        )
    )
  );

ALTER POLICY "infringements_org_or_user_with_mode_isolation" ON public.infringements
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.cases c
      LEFT JOIN public.profiles p ON p.id = auth.uid()
      LEFT JOIN public.org_settings o ON o.organization_id = p.organization_id
      WHERE c.id = infringements.case_id
        AND (
          (p.organization_id IS NOT NULL AND c.organization_id = p.organization_id)
          OR c.user_id = auth.uid()
        )
        AND (
          (COALESCE(o.persona, 'brand_owner') = 'law_firm' AND c.client_id IS NOT NULL)
          OR (COALESCE(o.persona, 'brand_owner') = 'brand_owner' AND c.client_id IS NULL)
        )
    )
  );

ALTER POLICY "evidence_org_or_user_with_mode_isolation" ON public.evidence
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.cases c
      LEFT JOIN public.profiles p ON p.id = auth.uid()
      LEFT JOIN public.org_settings o ON o.organization_id = p.organization_id
      WHERE c.id = evidence.case_id
        AND (
          (p.organization_id IS NOT NULL AND c.organization_id = p.organization_id)
          OR c.user_id = auth.uid()
        )
        AND (
          (COALESCE(o.persona, 'brand_owner') = 'law_firm' AND c.client_id IS NOT NULL)
          OR (COALESCE(o.persona, 'brand_owner') = 'brand_owner' AND c.client_id IS NULL)
        )
    )
  );

ALTER POLICY "takedown_reports_org_or_user_with_mode_isolation" ON public.takedown_reports
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.cases c
      LEFT JOIN public.profiles p ON p.id = auth.uid()
      LEFT JOIN public.org_settings o ON o.organization_id = p.organization_id
      WHERE c.id = takedown_reports.case_id
        AND (
          (p.organization_id IS NOT NULL AND c.organization_id = p.organization_id)
          OR c.user_id = auth.uid()
        )
        AND (
          (COALESCE(o.persona, 'brand_owner') = 'law_firm' AND c.client_id IS NOT NULL)
          OR (COALESCE(o.persona, 'brand_owner') = 'brand_owner' AND c.client_id IS NULL)
        )
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
