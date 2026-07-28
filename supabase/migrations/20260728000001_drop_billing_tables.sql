-- 20260728000001_drop_billing_tables.sql
--
-- Book-a-demo pivot cleanup: remove the dead Stripe / billing / entitlement schema.
--
-- Context: HAKKIU dropped all pricing / Stripe / plan-gating. Access is now purely
-- login-based (staff provision customer logins from the Admin Portal). The tables below
-- were created for the old subscription model and are referenced by ZERO application code
-- (verified across src/, apps/api, apps/admin-api, apps/admin — only stale comments remain).
--
-- The original CREATE migrations are intentionally KEPT on disk as DB history; this is a
-- forward migration that removes the now-unused objects from the live schema.
--
-- Dropped here:
--   * subscription_addons        (20260707000001_billing.sql)  — FK → subscriptions
--   * subscriptions              (20260707000001_billing.sql)
--   * invoices                   (20260707000001_billing.sql)
--   * stripe_events              (20260707000002_billing_hardening.sql)
--   * org_entitlement_overrides  (20260722000002_entitlement_overrides.sql)
--   * org_settings.stripe_customer_id column (20260707000001_billing.sql)
--
-- Deliberately NOT touched:
--   * profiles.plan column — still returned by GET /api/v1/me (auth.py) and asserted in
--     tests. It is now cosmetic (no feature is gated by it) but removing it would break the
--     API contract, so it stays.
--   * trg_protect_privileged_profile_columns trigger — it guards BOTH is_admin AND plan.
--     is_admin protection is a live security control, so the trigger is left intact. The
--     incidental plan protection is harmless (plan grants nothing).

-- Child table first (has FK → subscriptions); CASCADE also handles it defensively.
DROP TABLE IF EXISTS public.subscription_addons CASCADE;
DROP TABLE IF EXISTS public.subscriptions       CASCADE;
DROP TABLE IF EXISTS public.invoices            CASCADE;
DROP TABLE IF EXISTS public.stripe_events       CASCADE;
DROP TABLE IF EXISTS public.org_entitlement_overrides CASCADE;

-- Stripe customer id was only ever written by the billing webhook (now gone).
ALTER TABLE public.org_settings DROP COLUMN IF EXISTS stripe_customer_id;
