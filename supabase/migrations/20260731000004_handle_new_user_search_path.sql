-- M6 — re-pin search_path on the live handle_new_user() (SECURITY DEFINER).
--
-- 20260714000001 hardened this function with `SET search_path`, but the later
-- org-model rewrite 20260720000014 redefined it WITHOUT the pin, regressing the
-- fix. A DEFINER function with an unpinned search_path is a privilege-escalation
-- vector: anyone able to create objects on an earlier-resolved schema can shadow
-- `profiles`/`organizations`/`organization_members` and have the function operate
-- on their table as the owner. This redefines the current (org-model) body WITH
-- the pin. Body is identical to 20260720000014 except for the SET clause.

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
