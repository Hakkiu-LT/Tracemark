-- Migration to support Law Firm Mode custom branding and strict mode isolation

-- 1. Add firm_name and firm_logo_url columns to org_settings
ALTER TABLE public.org_settings ADD COLUMN IF NOT EXISTS firm_name TEXT DEFAULT NULL;
ALTER TABLE public.org_settings ADD COLUMN IF NOT EXISTS firm_logo_url TEXT DEFAULT NULL;

-- 2. Drop existing clients policy and add organization-scoped policy
DROP POLICY IF EXISTS "allow_all_authenticated" ON public.clients;

CREATE POLICY "clients_org_isolation" ON public.clients
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.organization_id IS NOT NULL 
              AND clients.organization_id = p.organization_id
        )
    );

-- 3. Update cases RLS for persona-based mode isolation
DROP POLICY IF EXISTS "cases_org_or_user" ON public.cases;

CREATE POLICY "cases_org_or_user_with_mode_isolation" ON public.cases
    FOR ALL USING (
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

-- 4. Update infringements RLS for persona-based mode isolation
DROP POLICY IF EXISTS "infringements_org_or_user" ON public.infringements;

CREATE POLICY "infringements_org_or_user_with_mode_isolation" ON public.infringements
    FOR ALL USING (
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

-- 5. Update evidence RLS for persona-based mode isolation
DROP POLICY IF EXISTS "evidence_org_or_user" ON public.evidence;

CREATE POLICY "evidence_org_or_user_with_mode_isolation" ON public.evidence
    FOR ALL USING (
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

-- 6. Update takedown_reports RLS for persona-based mode isolation
DROP POLICY IF EXISTS "takedown_reports_org_or_user" ON public.takedown_reports;

CREATE POLICY "takedown_reports_org_or_user_with_mode_isolation" ON public.takedown_reports
    FOR ALL USING (
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
