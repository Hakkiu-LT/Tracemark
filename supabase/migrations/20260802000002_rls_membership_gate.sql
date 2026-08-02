-- Migration: Phase 6 RLS Tightening — enforce organization_members membership for multi-tenancy.

-- 1. Helper function: check if caller is any member (owner or member) of the org
CREATE OR REPLACE FUNCTION public.user_is_org_member(org UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members m
    WHERE m.organization_id = org
      AND m.user_id = auth.uid()
  );
$$;

-- 2. Brands SELECT policy: caller must be an org member or owner of the brand row
DROP POLICY IF EXISTS "brands_org_or_user" ON public.brands;
CREATE POLICY "brands_org_or_user" ON public.brands
  FOR SELECT USING (
    user_id = auth.uid()
    OR (organization_id IS NOT NULL AND public.user_is_org_member(organization_id))
  );

-- 3. Brands write policies (INSERT, UPDATE, DELETE): caller must be an org owner
DROP POLICY IF EXISTS "brands_write_owner" ON public.brands;
CREATE POLICY "brands_write_owner" ON public.brands
  FOR ALL
  USING (
    organization_id IS NOT NULL AND public.user_is_org_owner(organization_id)
  )
  WITH CHECK (
    organization_id IS NOT NULL AND public.user_is_org_owner(organization_id)
  );
