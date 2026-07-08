-- Billing hardening:
--   1. A dedicated `user_id` ownership column so RLS no longer overloads
--      `organization_id` with auth user ids (which conflated two namespaces).
--   2. A `stripe_events` table for webhook idempotency (dedupe by event id).

-- ── 1. user_id ownership ─────────────────────────────────────────────────────
ALTER TABLE public.subscriptions       ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE public.subscription_addons ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE public.invoices            ADD COLUMN IF NOT EXISTS user_id UUID;

-- Backfill: where organization_id actually holds a user id (the single-member
-- fallback anchor), copy it into user_id so existing personal billing keeps
-- working under the tightened policy below.
UPDATE public.subscriptions s SET user_id = s.organization_id
  WHERE s.user_id IS NULL
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = s.organization_id);
UPDATE public.subscription_addons a SET user_id = a.organization_id
  WHERE a.user_id IS NULL
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = a.organization_id);
UPDATE public.invoices i SET user_id = i.organization_id
  WHERE i.user_id IS NULL
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = i.organization_id);

-- ── 2. Tightened SELECT policies: org membership OR explicit user ownership ───
-- No more `organization_id = auth.uid()`, which could theoretically match another
-- org whose id equaled a user's uid.
DROP POLICY IF EXISTS "subscriptions_org_or_user" ON public.subscriptions;
CREATE POLICY "subscriptions_org_or_user" ON public.subscriptions
  FOR SELECT USING (
    subscriptions.user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.organization_id IS NOT NULL
        AND p.organization_id = subscriptions.organization_id
    )
  );

DROP POLICY IF EXISTS "subscription_addons_org_or_user" ON public.subscription_addons;
CREATE POLICY "subscription_addons_org_or_user" ON public.subscription_addons
  FOR SELECT USING (
    subscription_addons.user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.organization_id IS NOT NULL
        AND p.organization_id = subscription_addons.organization_id
    )
  );

DROP POLICY IF EXISTS "invoices_org_or_user" ON public.invoices;
CREATE POLICY "invoices_org_or_user" ON public.invoices
  FOR SELECT USING (
    invoices.user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.organization_id IS NOT NULL
        AND p.organization_id = invoices.organization_id
    )
  );

-- ── 3. Webhook idempotency ledger ────────────────────────────────────────────
-- Only the service role (bypasses RLS) writes/reads this; no policies needed.
CREATE TABLE IF NOT EXISTS public.stripe_events (
    id          TEXT PRIMARY KEY,      -- Stripe event id (evt_...)
    type        TEXT,
    received_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;
