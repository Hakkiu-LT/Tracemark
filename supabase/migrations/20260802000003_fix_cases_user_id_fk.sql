-- Fix foreign key constraint on cases.user_id to ON DELETE SET NULL so user deletion succeeds cleanly.
DO $$
BEGIN
    -- Drop existing un-cascaded foreign key constraint if present
    ALTER TABLE public.cases DROP CONSTRAINT IF EXISTS cases_user_id_fkey;
END $$;

ALTER TABLE public.cases
    ADD CONSTRAINT cases_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
