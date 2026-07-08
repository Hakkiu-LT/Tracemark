-- Stripe billing: subscriptions, add-ons, invoices, and the Stripe customer link.
--
-- Billing is anchored on `organization_id`. For users without an organization,
-- the backend uses the user's own id as the anchor (a single-member org), so the
-- RLS policies below accept both `= profile.organization_id` and `= auth.uid()`.
--
-- NOTE: the FastAPI backend writes these tables with the service-role key, which
-- bypasses RLS. These policies exist to safely allow read access if the frontend
-- ever queries the tables directly.

-- ── Stripe customer id on the org settings row ───────────────────────────────
ALTER TABLE public.org_settings
    ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- ── subscriptions ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id       UUID NOT NULL,
    stripe_customer_id    TEXT,
    stripe_subscription_id TEXT UNIQUE,
    plan                  TEXT NOT NULL,                 -- starter | growth | pro | agency
    status                TEXT NOT NULL DEFAULT 'incomplete',
                          -- active | past_due | canceled | incomplete | trialing | unpaid
    interval              TEXT NOT NULL DEFAULT 'month', -- month | year
    current_period_end    TIMESTAMPTZ,
    cancel_at_period_end  BOOLEAN NOT NULL DEFAULT false,
    created_at            TIMESTAMPTZ DEFAULT now(),
    updated_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS subscriptions_org_idx
    ON public.subscriptions (organization_id);

-- ── subscription_addons ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.subscription_addons (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE CASCADE,
    addon_key       TEXT NOT NULL,                       -- addon_region | addon_domains | ...
    stripe_item_id  TEXT,
    quantity        INTEGER NOT NULL DEFAULT 1,
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS subscription_addons_org_idx
    ON public.subscription_addons (organization_id);

-- ── invoices (synced from Stripe webhooks) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.invoices (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id    UUID NOT NULL,
    stripe_invoice_id  TEXT UNIQUE,
    amount_due         INTEGER NOT NULL DEFAULT 0,       -- in the smallest currency unit (cents)
    currency           TEXT NOT NULL DEFAULT 'usd',
    status             TEXT NOT NULL DEFAULT 'draft',    -- draft | open | paid | void | uncollectible
    hosted_invoice_url TEXT,
    invoice_pdf        TEXT,
    created_at         TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS invoices_org_idx
    ON public.invoices (organization_id);

-- ── RLS: org-scoped, with the user-id fallback anchor ────────────────────────
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subscriptions_org_or_user" ON public.subscriptions
    FOR SELECT USING (
        organization_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.organization_id = subscriptions.organization_id
        )
    );

CREATE POLICY "subscription_addons_org_or_user" ON public.subscription_addons
    FOR SELECT USING (
        organization_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.organization_id = subscription_addons.organization_id
        )
    );

CREATE POLICY "invoices_org_or_user" ON public.invoices
    FOR SELECT USING (
        organization_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.organization_id = invoices.organization_id
        )
    );
