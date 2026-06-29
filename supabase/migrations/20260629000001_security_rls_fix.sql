-- Fix overly-broad RLS policies that let any authenticated user read all rows.
-- Replace them with org-scoped or user-scoped policies.

-- ── evidence ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "allow_all_authenticated" ON public.evidence;

CREATE POLICY "evidence_org_or_user" ON public.evidence
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.cases c
      LEFT JOIN public.profiles p ON p.id = auth.uid()
      WHERE c.id = evidence.case_id
        AND (
          (p.organization_id IS NOT NULL AND c.organization_id = p.organization_id)
          OR c.user_id = auth.uid()
        )
    )
  );

-- ── decisions ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "allow_all_authenticated" ON public.decisions;

CREATE POLICY "decisions_org_or_user" ON public.decisions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.cases c
      LEFT JOIN public.profiles p ON p.id = auth.uid()
      WHERE c.id = decisions.case_id
        AND (
          (p.organization_id IS NOT NULL AND c.organization_id = p.organization_id)
          OR c.user_id = auth.uid()
        )
    )
  );

-- ── cases: remove the "user_id IS NULL" escape hatch ─────────────────────────
-- Rows without user_id are legacy; they should only be visible to org admins,
-- not to every authenticated user.
DROP POLICY IF EXISTS "cases_own" ON public.cases;

CREATE POLICY "cases_org_or_user" ON public.cases
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (
          (p.organization_id IS NOT NULL AND cases.organization_id = p.organization_id)
          OR cases.user_id = auth.uid()
        )
    )
  );

-- ── infringements: scope to org/user via cases join ──────────────────────────
ALTER TABLE public.infringements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all_authenticated" ON public.infringements;
DROP POLICY IF EXISTS "infringements_org_or_user" ON public.infringements;

CREATE POLICY "infringements_org_or_user" ON public.infringements
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.cases c
      LEFT JOIN public.profiles p ON p.id = auth.uid()
      WHERE c.id = infringements.case_id
        AND (
          (p.organization_id IS NOT NULL AND c.organization_id = p.organization_id)
          OR c.user_id = auth.uid()
        )
    )
  );

-- ── takedown_reports: scope to org/user via cases join ───────────────────────
ALTER TABLE public.takedown_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all_authenticated" ON public.takedown_reports;
DROP POLICY IF EXISTS "takedown_reports_org_or_user" ON public.takedown_reports;

CREATE POLICY "takedown_reports_org_or_user" ON public.takedown_reports
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.cases c
      LEFT JOIN public.profiles p ON p.id = auth.uid()
      WHERE c.id = takedown_reports.case_id
        AND (
          (p.organization_id IS NOT NULL AND c.organization_id = p.organization_id)
          OR c.user_id = auth.uid()
        )
    )
  );
