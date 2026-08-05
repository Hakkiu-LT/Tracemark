-- Migration: plan limits as ALLOW-LISTS, not counts (Session 53)
--
-- Correction to 20260805000003: staff don't want "max N regions / M marketplaces" (a count).
-- They agree a concrete plan with the customer — e.g. "2 brands, scan ONLY Amazon, ONLY USA" —
-- and must be able to whitelist the SPECIFIC marketplaces and regions the customer may use.
-- The customer's "Add monitored asset" pickers then show ONLY those allowed options.
--
-- Model on org_entitlement_overrides:
--   * brands_limit        int      — org-total max number of brands (unchanged; NULL/-1 = unlimited)
--   * allowed_platforms   text[]   — whitelist of marketplace apiKeys; NULL/empty = all allowed
--   * allowed_regions     text[]   — whitelist of region country codes; NULL/empty = all allowed
--
-- Regions are stored at COUNTRY-CODE granularity (US, CA, DE, …) so "only USA" is expressible.

-- ── 1. Replace the count columns (added in ...000003, no data depends on them) with allow-lists ──
ALTER TABLE public.org_entitlement_overrides
    DROP COLUMN IF EXISTS regions_per_brand_limit,
    DROP COLUMN IF EXISTS platforms_per_brand_limit,
    ADD COLUMN IF NOT EXISTS allowed_platforms text[],
    ADD COLUMN IF NOT EXISTS allowed_regions   text[];

-- ── 2. Enforce the whitelists inside the single atomic brand-insert path ─────────
-- Same signature as before (allow-lists are read from the table, not passed in) so the
-- existing GRANT/REVOKE stays valid.
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
    v_brands_limit      int;
    v_allowed_platforms text[];
    v_allowed_regions   text[];
    v_used              int;
    v_row               public.brands;
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

    SELECT brands_limit, allowed_platforms, allowed_regions
      INTO v_brands_limit, v_allowed_platforms, v_allowed_regions
    FROM public.org_entitlement_overrides
    WHERE organization_id = p_organization_id;

    -- Marketplace whitelist. NULL/empty = unrestricted. Every selected platform must be allowed.
    IF v_allowed_platforms IS NOT NULL AND array_length(v_allowed_platforms, 1) > 0 THEN
        IF EXISTS (
            SELECT 1 FROM unnest(COALESCE(p_platforms, '{}')) AS x
            WHERE NOT (x = ANY(v_allowed_platforms))
        ) THEN
            RAISE EXCEPTION 'PLATFORM_NOT_ALLOWED: selection includes a marketplace not in the plan'
                USING ERRCODE = 'check_violation';
        END IF;
    END IF;

    -- Region whitelist. NULL/empty = unrestricted. Every selected region must be allowed.
    IF v_allowed_regions IS NOT NULL AND array_length(v_allowed_regions, 1) > 0 THEN
        IF EXISTS (
            SELECT 1 FROM unnest(COALESCE(p_target_regions, '{}')) AS x
            WHERE NOT (x = ANY(v_allowed_regions))
        ) THEN
            RAISE EXCEPTION 'REGION_NOT_ALLOWED: selection includes a region not in the plan'
                USING ERRCODE = 'check_violation';
        END IF;
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

REVOKE ALL ON FUNCTION public.create_brand_checked(
    uuid, uuid, text, text, text, text[], text[], text, text[], text[], uuid
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_brand_checked(
    uuid, uuid, text, text, text, text[], text[], text, text[], text[], uuid
) TO service_role;
