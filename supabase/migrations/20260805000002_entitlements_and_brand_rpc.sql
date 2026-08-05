-- Migration: Entitlements v2 + atomic brand-create RPC (Session 51)
--
-- The original org_entitlement_overrides table was dropped in the book-a-demo pivot
-- (20260728000001). This recreates a MINIMAL version scoped to the only limit staff need
-- today — a per-org brand cap — plus a SECURITY DEFINER RPC that is the SINGLE, atomic,
-- limit-enforced path for creating a brand. BOTH the customer API and the admin API call
-- this RPC, so neither can bypass the cap.

-- ── 1. Minimal per-org override table ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.org_entitlement_overrides (
    organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
    -- NULL or -1 = unlimited; >= 0 = hard cap on number of brands.
    brands_limit    int CHECK (brands_limit >= -1),
    note            text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.org_entitlement_overrides ENABLE ROW LEVEL SECURITY;

-- Only the service role (admin-api + main-api) may read/write. Customers never touch this.
DROP POLICY IF EXISTS "service_role_all" ON public.org_entitlement_overrides;
CREATE POLICY "service_role_all" ON public.org_entitlement_overrides
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── 2. Atomic, limit-checked brand insert ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_brand_checked(
    p_organization_id     uuid,
    p_user_id             uuid    DEFAULT NULL,
    p_brand_name          text    DEFAULT NULL,
    p_website             text    DEFAULT NULL,
    p_registration_number text    DEFAULT NULL,
    p_platforms           text[]  DEFAULT '{}',
    p_target_regions      text[]  DEFAULT '{}',
    p_logo_color          text    DEFAULT NULL,
    p_official_domains    text[]  DEFAULT '{}',
    p_official_advertisers text[] DEFAULT '{}',
    p_client_id           uuid    DEFAULT NULL
)
RETURNS public.brands
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_limit int;
    v_used  int;
    v_row   public.brands;
BEGIN
    IF p_organization_id IS NULL THEN
        RAISE EXCEPTION 'organization_id is required';
    END IF;
    IF COALESCE(btrim(p_brand_name), '') = '' THEN
        RAISE EXCEPTION 'brand_name is required';
    END IF;

    -- Serialize brand creation per org so two concurrent inserts cannot both pass the
    -- cap check and exceed it. Released automatically at transaction end.
    PERFORM pg_advisory_xact_lock(hashtext(p_organization_id::text));

    SELECT brands_limit INTO v_limit
    FROM public.org_entitlement_overrides
    WHERE organization_id = p_organization_id;

    -- NULL row or NULL/-1 value = unlimited.
    IF v_limit IS NOT NULL AND v_limit >= 0 THEN
        SELECT count(*) INTO v_used
        FROM public.brands
        WHERE organization_id = p_organization_id;

        IF v_used >= v_limit THEN
            RAISE EXCEPTION 'BRAND_LIMIT_REACHED: % of % brands used', v_used, v_limit
                USING ERRCODE = 'check_violation';
        END IF;
    END IF;

    INSERT INTO public.brands (
        organization_id, user_id, client_id, brand_name, website, registration_number,
        platforms, target_regions, logo_color, official_domains, official_advertisers, status
    ) VALUES (
        p_organization_id, p_user_id, p_client_id, p_brand_name, p_website, p_registration_number,
        COALESCE(p_platforms, '{}'), COALESCE(p_target_regions, '{}'), p_logo_color,
        COALESCE(p_official_domains, '{}'), COALESCE(p_official_advertisers, '{}'), 'active'
    )
    RETURNING * INTO v_row;

    RETURN v_row;
END;
$$;

-- The RPC is called only by the backends (service role). Lock it down.
REVOKE ALL ON FUNCTION public.create_brand_checked(
    uuid, uuid, text, text, text, text[], text[], text, text[], text[], uuid
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_brand_checked(
    uuid, uuid, text, text, text, text[], text[], text, text[], text[], uuid
) TO service_role;
