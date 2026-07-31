-- L7 — add WITH CHECK to policies that only had USING.
--
-- A FOR ALL policy with USING but no WITH CHECK validates which rows you can READ,
-- but not what you may WRITE — so an INSERT/UPDATE could set columns (e.g.
-- organization_id) that escape the intended scope. These two policies rely on a
-- column freeze (profiles) / are service-role-write today (clients), but adding
-- WITH CHECK is defence-in-depth so the policy itself enforces the scope.

-- profiles: you may only read/write your own row.
DROP POLICY IF EXISTS "profiles_own" ON public.profiles;
CREATE POLICY "profiles_own" ON public.profiles
  FOR ALL
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- clients: rows stay inside the caller's organization on write, not just read.
DROP POLICY IF EXISTS "clients_org_isolation" ON public.clients;
CREATE POLICY "clients_org_isolation" ON public.clients
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.organization_id IS NOT NULL
        AND clients.organization_id = p.organization_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.organization_id IS NOT NULL
        AND clients.organization_id = p.organization_id
    )
  );
