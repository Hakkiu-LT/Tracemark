-- profiles table already created by Domantas — just ensure RLS and policy exist
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_own" ON public.profiles;
CREATE POLICY "profiles_own" ON public.profiles
  FOR ALL USING (auth.uid() = id);

-- Auto-create a profile row when a new user signs up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Add user_id to cases so each case belongs to the user who created it
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Replace the overly broad "all authenticated" policy with user-scoped access
DROP POLICY IF EXISTS "allow_all_authenticated" ON public.cases;

CREATE POLICY "cases_own" ON public.cases
  FOR ALL USING (
    auth.uid() = user_id
    OR user_id IS NULL  -- allow existing rows without user_id to remain visible
  );
