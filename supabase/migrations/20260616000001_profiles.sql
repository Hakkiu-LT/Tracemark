-- Profiles: extra user metadata that Supabase Auth (auth.users) doesn't natively hold.
-- One row per auth user, auto-created on sign-up via the on_auth_user_created trigger.

CREATE TABLE IF NOT EXISTS public.profiles (
    id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name       TEXT,
    avatar_url      TEXT,
    -- Single active org for now (mirrors public.cases.organization_id; no FK, no
    -- organizations table yet). TODO(backend/Martynas): users can belong to several
    -- orgs — replace with an organization_members join table when that lands.
    organization_id UUID,
    plan            TEXT NOT NULL DEFAULT 'free',  -- 'free' | 'pro'
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- Auto-create a profile row whenever a new auth user is created.
-- SECURITY DEFINER so the insert runs with owner privileges and bypasses RLS.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'avatar_url'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS: each user can read and update only their own profile row.
-- Inserts happen via the SECURITY DEFINER trigger above, so no insert policy is needed.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

