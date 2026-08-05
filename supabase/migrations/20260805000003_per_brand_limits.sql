-- Migration: 3-dimensional plan limits (Session 52)
--
-- Extends the entitlement model from a single org-wide brand cap to THREE dimensions:
--   1. brands_limit             — org-total number of brands           (already existed)
--   2. regions_per_brand_limit  — max target regions selectable PER brand   (NEW)
--   3. platforms_per_brand_limit— max marketplaces/platforms PER brand       (NEW)
--
-- Regions and platforms are configured per monitored asset (per brand) in the customer UI,
-- so the natural, enforceable cap is "each brand may target up to N regions and M
-- marketplaces". All three: NULL or -1 = unlimited; >= 0 = hard cap.
--
-- Enforcement stays single-source in create_brand_checked (the ONE atomic brand-insert path
-- shared by the customer API and the admin API). We keep the function SIGNATURE identical so
-- the existing GRANT/REVOKE stays valid — the new caps are read from the table, not passed in.

-- ── 1. New columns ──────────────────────────────────────────────────────────────
ALTER TABLE public.org_entitlement_overrides
    ADD COLUMN IF NOT EXISTS regions_per_brand_limit   int CHECK (regions_per_brand_limit   >= -1),
    ADD COLUMN IF NOT EXISTS platforms_per_brand_limit int CHECK (platforms_per_brand_limit >= -1);

-- ── 2. Extend the atomic, limit-checked brand insert ─────────────────────────────
-- Same signature as 20260805000002 (no new params). Adds per-brand region/platform caps.
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
    v_brands_limit    int;
    v_regions_limit   int;
    v_platforms_limit int;
    v_used            int;
    v_n_regions       int := COALESCE(array_length(p_target_regions, 1), 0);
    v_n_platforms     int := COALESCE(array_length(p_platforms, 1), 0);
    v_row             public.brands;
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

    SELECT brands_limit, regions_per_brand_limit, platforms_per_brand_limit
      INTO v_brands_limit, v_regions_limit, v_platforms_limit
    FROM public.org_entitlement_overrides
    WHERE organization_id = p_organization_id;

    -- Per-brand region cap. NULL/-1 = unlimited.
    IF v_regions_limit IS NOT NULL AND v_regions_limit >= 0 AND v_n_regions > v_regions_limit THEN
        RAISE EXCEPTION 'REGION_LIMIT_REACHED: % of % regions selected', v_n_regions, v_regions_limit
            USING ERRCODE = 'check_violation';
    END IF;

    -- Per-brand platform/marketplace cap. NULL/-1 = unlimited.
    IF v_platforms_limit IS NOT NULL AND v_platforms_limit >= 0 AND v_n_platforms > v_platforms_limit THEN
        RAISE EXCEPTION 'PLATFORM_LIMIT_REACHED: % of % marketplaces selected', v_n_platforms, v_platforms_limit
            USING ERRCODE = 'check_violation';
    END IF;

    -- Org-total brand cap. NULL row or NULL/-1 value = unlimited.
    IF v_brands_limit IS NOT NULL AND v_brands_limit >= 0 THEN
        SELECT count(*) INTO v_used
        FROM public.brands
        WHERE organization_id = p_organization_id;

        IF v_used >= v_brands_limit THEN
            RAISE EXCEPTION 'BRAND_LIMIT_REACHED: % of % brands used', v_used, v_brands_limit
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

-- Signature is unchanged, but re-assert the grants so a fresh replay is self-contained.
REVOKE ALL ON FUNCTION public.create_brand_checked(
    uuid, uuid, text, text, text, text[], text[], text, text[], text[], uuid
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_brand_checked(
    uuid, uuid, text, text, text, text[], text[], text, text[], text[], uuid
) TO service_role;
