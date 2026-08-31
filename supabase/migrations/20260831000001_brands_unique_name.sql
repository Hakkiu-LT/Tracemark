-- Two brands with the same name in one organization are always a mistake — they are the
-- same trademark being monitored twice: duplicate scans, duplicate scraper quota, duplicate
-- infringement rows, and a customer-facing list with the same asset in it twice.
--
-- Nothing prevented it. `create_brand_checked` took a per-org advisory lock (for the brand
-- CAP) but never looked at the name, so submitting "Add asset" twice — a double click, a
-- retried request, or simply filling the form again — inserted a second, genuinely separate
-- row. This closes it at both levels: a real unique index (authoritative, also covers the
-- PATCH rename path and any future write path), plus an explicit check inside the RPC so
-- the customer gets a readable message instead of a raw constraint violation.

-- ── 1. Make existing data satisfy the constraint ──────────────────────────────────────
-- A CREATE UNIQUE INDEX would ABORT this migration if any org already holds duplicates,
-- so resolve them first. NOTHING IS DELETED: the earliest row of each group keeps its name
-- and every later one is renamed with a suffix, which is visible to the customer and easy
-- to merge or rename by hand afterwards. Each rename is logged via RAISE NOTICE — check the
-- migration output to see whether any rows were touched (on a clean database, none are).
DO $$
DECLARE
    r          record;
    candidate  text;
    attempt    int;
BEGIN
    FOR r IN
        SELECT id, organization_id, brand_name, rn
        FROM (
            SELECT id, organization_id, brand_name,
                   row_number() OVER (
                       PARTITION BY organization_id, lower(btrim(brand_name))
                       ORDER BY created_at NULLS LAST, id
                   ) AS rn
            FROM public.brands
        ) ranked
        WHERE rn > 1
        ORDER BY organization_id, rn
    LOOP
        -- The suffixed name could itself already be taken; keep counting until it is free.
        attempt := r.rn;
        LOOP
            candidate := btrim(r.brand_name) || ' (duplicate ' || attempt || ')';
            EXIT WHEN NOT EXISTS (
                SELECT 1 FROM public.brands
                WHERE organization_id = r.organization_id
                  AND lower(btrim(brand_name)) = lower(btrim(candidate))
            );
            attempt := attempt + 1;
        END LOOP;

        UPDATE public.brands SET brand_name = candidate WHERE id = r.id;
        RAISE NOTICE 'brands: org % had a duplicate name; renamed % to "%"',
            r.organization_id, r.id, candidate;
    END LOOP;
END $$;

-- ── 2. The constraint itself ──────────────────────────────────────────────────────────
-- Case- and whitespace-insensitive, because "Derila", "derila" and "Derila " are the same
-- trademark to a customer — and because the frontend already matches marks to server brands
-- with exactly this normalisation (trim + lowercase) in syncServerBrands.
CREATE UNIQUE INDEX IF NOT EXISTS brands_org_name_unique
    ON public.brands (organization_id, lower(btrim(brand_name)));

COMMENT ON INDEX public.brands_org_name_unique IS
    'One brand name per organization (trimmed, case-insensitive). Prevents duplicate rows '
    'from a double-submitted "Add asset" form or a PATCH that renames one brand onto another.';

-- ── 3. Readable error instead of a raw 23505 ──────────────────────────────────────────
-- Same body as 20260805000004, with the name check added INSIDE the advisory lock so two
-- concurrent creates of the same name cannot both pass it. The index above is the real
-- guarantee; this exists so the API can answer 409 with a sentence a customer understands.
-- brand_name is now stored trimmed, matching what the index compares on.
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
    v_name              text;
    v_row               public.brands;
BEGIN
    IF p_organization_id IS NULL THEN
        RAISE EXCEPTION 'organization_id is required';
    END IF;
    IF COALESCE(btrim(p_brand_name), '') = '' THEN
        RAISE EXCEPTION 'brand_name is required';
    END IF;
    v_name := btrim(p_brand_name);

    -- Serialize brand creation per org so two concurrent inserts cannot both pass the
    -- cap check and exceed it. Released automatically at transaction end.
    PERFORM pg_advisory_xact_lock(hashtext(p_organization_id::text));

    -- Duplicate name check. Inside the lock, so a double-submitted form serializes and the
    -- second call sees the first one's row.
    IF EXISTS (
        SELECT 1 FROM public.brands
        WHERE organization_id = p_organization_id
          AND lower(btrim(brand_name)) = lower(v_name)
    ) THEN
        RAISE EXCEPTION 'BRAND_NAME_TAKEN: % is already monitored by this organization', v_name
            USING ERRCODE = 'unique_violation';
    END IF;

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
        p_organization_id, p_user_id, p_client_id, v_name, p_website, p_registration_number,
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
