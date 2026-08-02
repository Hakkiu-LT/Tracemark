-- Migration: Groups V1 — Organizations, roles, home organization tracking, and Hakkiu staff org.

-- 1a. Create the well-known Hakkiu organization (nil UUID)
INSERT INTO public.organizations (id, name, industry)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'Hakkiu',
  'SaaS / Internal'
)
ON CONFLICT (id) DO NOTHING;

-- 1b. Add home_organization_id column to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS home_organization_id UUID;

-- 1c. Backfill home_organization_id for existing profiles
UPDATE public.profiles
SET home_organization_id = organization_id
WHERE home_organization_id IS NULL;

-- 1d. Move active staff accounts to the Hakkiu organization
UPDATE public.profiles
SET organization_id      = '00000000-0000-0000-0000-000000000000',
    home_organization_id = '00000000-0000-0000-0000-000000000000'
WHERE id IN (SELECT id FROM public.staff_accounts WHERE is_active = true);

INSERT INTO public.organization_members (organization_id, user_id, role)
SELECT '00000000-0000-0000-0000-000000000000', id, 'owner'
FROM public.staff_accounts
WHERE is_active = true
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- 1e. Retire profiles.is_admin column and update protection trigger
CREATE OR REPLACE FUNCTION public.protect_privileged_profile_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF COALESCE(auth.role(), '') IS DISTINCT FROM 'service_role' THEN
    NEW.plan                 := OLD.plan;
    NEW.organization_id      := OLD.organization_id;
    NEW.home_organization_id := OLD.home_organization_id;
  END IF;
  RETURN NEW;
END;
$$;

ALTER TABLE public.profiles DROP COLUMN IF EXISTS is_admin;

-- 1f. Retire 'admin' org role — migrate existing 'admin' roles to 'owner' and update CHECK constraint
UPDATE public.organization_members SET role = 'owner' WHERE role = 'admin';

ALTER TABLE public.organization_members DROP CONSTRAINT IF EXISTS organization_members_role_check;
ALTER TABLE public.organization_members ADD CONSTRAINT organization_members_role_check
  CHECK (role IN ('owner', 'member'));

-- 1g. Helper function: check if caller is an owner of the org
CREATE OR REPLACE FUNCTION public.user_is_org_owner(org UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members m
    WHERE m.organization_id = org
      AND m.user_id = auth.uid()
      AND m.role = 'owner'
  );
$$;

-- 1h. RPC: assign_user_to_group (transactional group membership + profile update)
CREATE OR REPLACE FUNCTION public.assign_user_to_group(
  p_user_id UUID,
  p_org_id UUID,
  p_role TEXT DEFAULT 'member'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- Prevent assigning to internal Hakkiu org
  IF p_org_id = '00000000-0000-0000-0000-000000000000'::uuid THEN
    RAISE EXCEPTION 'Cannot assign customer users to internal Hakkiu organization';
  END IF;

  -- Validate org exists
  IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = p_org_id) THEN
    RAISE EXCEPTION 'Organization not found';
  END IF;

  -- Validate user exists
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Validate role
  IF p_role NOT IN ('owner', 'member') THEN
    RAISE EXCEPTION 'Invalid role: %', p_role;
  END IF;

  -- Upsert membership
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (p_org_id, p_user_id, p_role)
  ON CONFLICT (organization_id, user_id)
  DO UPDATE SET role = EXCLUDED.role;

  -- Switch active org
  UPDATE public.profiles
  SET organization_id = p_org_id
  WHERE id = p_user_id;

  SELECT jsonb_build_object(
    'user_id', p_user_id,
    'organization_id', p_org_id,
    'role', p_role
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- 1i. RPC: remove_user_from_group (removes membership, returns user to home org)
CREATE OR REPLACE FUNCTION public.remove_user_from_group(
  p_user_id UUID,
  p_org_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_home UUID;
  v_is_last_owner BOOLEAN;
BEGIN
  -- Prevent removing staff from Hakkiu org via group RPC
  IF p_org_id = '00000000-0000-0000-0000-000000000000'::uuid THEN
    RAISE EXCEPTION 'Cannot remove members from internal Hakkiu organization via group removal';
  END IF;

  -- Check if this is the last owner of the group
  SELECT NOT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = p_org_id
      AND user_id != p_user_id
      AND role = 'owner'
  ) INTO v_is_last_owner;

  IF v_is_last_owner AND EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = p_org_id
      AND user_id = p_user_id
      AND role = 'owner'
  ) THEN
    RAISE EXCEPTION 'Cannot remove the last owner. Transfer ownership first.';
  END IF;

  -- Delete membership
  DELETE FROM public.organization_members
  WHERE organization_id = p_org_id AND user_id = p_user_id;

  -- Return to home org
  SELECT home_organization_id INTO v_home
  FROM public.profiles WHERE id = p_user_id;

  UPDATE public.profiles
  SET organization_id = COALESCE(v_home, p_user_id)
  WHERE id = p_user_id
    AND organization_id = p_org_id;

  RETURN jsonb_build_object(
    'user_id', p_user_id,
    'returned_to', COALESCE(v_home, p_user_id)
  );
END;
$$;

-- 1j. Update handle_new_user() to populate home_organization_id
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    INSERT INTO public.organizations (id, name)
    VALUES (NEW.id, split_part(COALESCE(NEW.email, ''), '@', 2))
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
