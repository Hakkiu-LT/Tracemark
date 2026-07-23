-- Per-org entitlement overrides (admin staff only).
-- These are applied ON TOP of plan+addon computed limits, giving staff full
-- control to negotiate custom limits for Pro/Enterprise customers without
-- touching Stripe or changing plan definitions in code.
--
-- Null fields = "use computed value from plan+addons". Non-null = override.
-- For numeric limits: -1 is serialised as NULL in entitlements.py (= unlimited).

CREATE TABLE IF NOT EXISTS org_entitlement_overrides (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Numeric overrides (null = don't override; value = cap; -1 = unlimited).
    brands_override     int         CHECK (brands_override >= -1),
    platforms_override  int         CHECK (platforms_override >= -1),
    regions_override    int         CHECK (regions_override >= -1),

    -- Boolean feature-flag overrides (null = don't override).
    domain_tracking     boolean,
    managed_takedown    boolean,
    api_access          boolean,
    advanced_reports    boolean,
    real_time_scans     boolean,

    -- Staff note for why this override was set.
    note                text,

    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),

    UNIQUE (organization_id)
);

-- Only the service role (admin-api + main-api) should write here.
ALTER TABLE org_entitlement_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON org_entitlement_overrides
    FOR ALL TO service_role USING (true) WITH CHECK (true);
