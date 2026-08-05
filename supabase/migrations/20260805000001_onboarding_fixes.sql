-- Migration: Onboarding fixes (Session 51)
-- 1. organizations.is_personal — deterministic flag replacing the fragile domain-name
--    heuristic in list_organizations. TRUE = auto-generated personal/home org (hidden from
--    the customer-company list). Company orgs created by staff are FALSE.
-- 2. handle_new_user() marks the personal org it creates as is_personal = true.
-- 3. org_settings.notification_email — DROP NOT NULL: an owner-less company created by staff
--    has no notification recipient yet. Removes the need for the fake org-xxxx@internal hack.

-- ── 1. is_personal column ──────────────────────────────────────────────────────
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS is_personal boolean NOT NULL DEFAULT false;

-- Backfill: a personal/home org is one whose id IS a user's own id (the handle_new_user
-- convention: org.id = user.id), that user's home_organization_id points back to it, it has
-- no brands, at most one member, and no industry. This is strictly the set the old runtime
-- heuristic hid — never marks an org that has brands or multiple members.
UPDATE public.organizations o
SET is_personal = true
WHERE o.id <> '00000000-0000-0000-0000-000000000000'::uuid
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = o.id AND p.home_organization_id = o.id
  )
  AND NOT EXISTS (SELECT 1 FROM public.brands b WHERE b.organization_id = o.id)
  AND (SELECT count(*) FROM public.organization_members m WHERE m.organization_id = o.id) <= 1
  AND o.industry IS NULL;

-- ── 2. handle_new_user() flags the personal org ────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    INSERT INTO public.organizations (id, name, is_personal)
    VALUES (NEW.id, split_part(COALESCE(NEW.email, ''), '@', 2), true)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.profiles (id, full_name, avatar_url, organization_id, home_organization_id)
    VALUES (
        NEW.id,
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'avatar_url',
        NEW.id,
        NEW.id
    )
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.organization_members (organization_id, user_id, role)
    VALUES (NEW.id, NEW.id, 'owner')
    ON CONFLICT (organization_id, user_id) DO NOTHING;

    RETURN NEW;
END;
$$;

-- ── 3. notification_email nullable ─────────────────────────────────────────────
ALTER TABLE public.org_settings ALTER COLUMN notification_email DROP NOT NULL;
