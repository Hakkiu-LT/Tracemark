-- Real multi-tenant ORGANIZATIONS model.
--
-- Until now a "company" was only profiles.organization_id (nullable UUID, no FK), and
-- each user was implicitly their own single-member org: billing/entitlements anchor on
-- `organization_id or user_id`. This migration makes organizations first-class WITHOUT
-- breaking that anchor: for single-member orgs we set organizations.id = the user's id,
-- so every existing subscriptions/brands/cases.organization_id keeps matching.

-- ── Tables ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.organizations (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT,                 -- the CUSTOMER's company name (shown in admin)
    industry    TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.organization_members (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL,     -- references auth.users(id)
    role            TEXT NOT NULL DEFAULT 'member',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT organization_members_role_check CHECK (role IN ('owner', 'admin', 'member')),
    CONSTRAINT organization_members_unique UNIQUE (organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS organization_members_org_idx  ON public.organization_members (organization_id);
CREATE INDEX IF NOT EXISTS organization_members_user_idx ON public.organization_members (user_id);

-- Reuse the existing update_updated_at() trigger fn (from week2_schema).
DROP TRIGGER IF EXISTS organizations_updated_at ON public.organizations;
CREATE TRIGGER organizations_updated_at
    BEFORE UPDATE ON public.organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- SECURITY DEFINER helper avoids recursive RLS when a policy on one table needs to
-- read the other (it runs as owner, bypassing RLS inside).
CREATE OR REPLACE FUNCTION public.user_is_org_member(org UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.organization_members m
        WHERE m.organization_id = org AND m.user_id = auth.uid()
    );
$$;

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "members can read their org" ON public.organizations;
CREATE POLICY "members can read their org" ON public.organizations
    FOR SELECT USING (public.user_is_org_member(id));

ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read memberships of my orgs" ON public.organization_members;
CREATE POLICY "read memberships of my orgs" ON public.organization_members
    FOR SELECT USING (user_id = auth.uid() OR public.user_is_org_member(organization_id));
-- Writes go through the admin backend (service-role) and, later, owner/admin self-serve.

-- ── Backfill (preserves the existing org_id-or-user_id anchor) ────────────────
-- 1. Single-member orgs (organization_id IS NULL): create an org whose id = user id.
INSERT INTO public.organizations (id, name)
SELECT p.id, split_part(COALESCE(u.email, ''), '@', 2)
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
WHERE p.organization_id IS NULL
ON CONFLICT (id) DO NOTHING;

-- 2. Existing shared orgs (organization_id IS NOT NULL): ensure a row exists.
INSERT INTO public.organizations (id)
SELECT DISTINCT p.organization_id
FROM public.profiles p
WHERE p.organization_id IS NOT NULL
ON CONFLICT (id) DO NOTHING;

-- 3. Point every profile at its resolved org (NULL -> own id).
UPDATE public.profiles SET organization_id = id WHERE organization_id IS NULL;

-- 4. Membership: every existing user is an 'owner' of their org.
INSERT INTO public.organization_members (organization_id, user_id, role)
SELECT p.organization_id, p.id, 'owner'
FROM public.profiles p
WHERE p.organization_id IS NOT NULL
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- 5. Fill any missing company name from a law-firm client name, else a member's email domain.
UPDATE public.organizations o SET name = COALESCE(
    (SELECT c.name FROM public.clients c
       WHERE c.organization_id = o.id AND c.name IS NOT NULL LIMIT 1),
    (SELECT split_part(COALESCE(u.email, ''), '@', 2)
       FROM public.profiles p JOIN auth.users u ON u.id = p.id
       WHERE p.organization_id = o.id LIMIT 1)
)
WHERE o.name IS NULL OR o.name = '';

-- ── Signup trigger: create an org + owner membership for every new user ───────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- New user's personal org uses their id (keeps the billing anchor intact).
    INSERT INTO public.organizations (id, name)
    VALUES (NEW.id, split_part(COALESCE(NEW.email, ''), '@', 2))
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.profiles (id, full_name, avatar_url, organization_id)
    VALUES (
        NEW.id,
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'avatar_url',
        NEW.id
    )
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.organization_members (organization_id, user_id, role)
    VALUES (NEW.id, NEW.id, 'owner')
    ON CONFLICT (organization_id, user_id) DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- Trigger on_auth_user_created is already bound (from 20260616000001_profiles.sql).
