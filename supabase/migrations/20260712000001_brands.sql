-- Monitored brands ("marks") persisted server-side.
--
-- Until now brands lived only in the browser's Zustand/localStorage, so the
-- server had no authoritative count and plan limits ("1 brand", "5 brands", …)
-- could not be enforced. This table makes brands a real, org-scoped entity so
-- billing entitlements can gate creation and downgrade can lock the excess.
--
-- Anchored on `organization_id` (same convention as billing). For users without
-- an organization the backend uses the user's own id as the anchor. The FastAPI
-- backend writes with the service-role key (bypasses RLS); the SELECT policy is
-- a safety net for any direct frontend reads.

CREATE TABLE IF NOT EXISTS public.brands (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL,
    user_id             UUID,                       -- ownership anchor for RLS
    client_id           UUID,                       -- law-firm mode (nullable)
    brand_name          TEXT NOT NULL,
    website             TEXT,
    registration_number TEXT,
    platforms           TEXT[] NOT NULL DEFAULT '{}',
    target_regions      TEXT[] NOT NULL DEFAULT '{}',
    logo_color          TEXT,
    status              TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'locked', 'on_hold')),
    last_scan_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS brands_org_idx        ON public.brands (organization_id);
CREATE INDEX IF NOT EXISTS brands_org_status_idx ON public.brands (organization_id, status);
CREATE INDEX IF NOT EXISTS brands_org_name_idx   ON public.brands (organization_id, brand_name);

-- ── RLS: org-scoped, with the user-id fallback anchor ────────────────────────
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brands_org_or_user" ON public.brands
    FOR SELECT USING (
        user_id = auth.uid()
        OR organization_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.organization_id = brands.organization_id
        )
    );
