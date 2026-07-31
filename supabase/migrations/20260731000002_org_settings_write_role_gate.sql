-- H6 — role-gate writes to org_settings.
--
-- Previously `org_settings_own_org` was FOR ALL for ANY member of the org. The
-- `persona` field drives every case/evidence/decision/takedown mode-isolation
-- policy, and notification_email routes breach notices — so any low-privilege
-- member could flip tenant isolation or redirect notifications. Split into:
--   * read  — any org member (unchanged behaviour, keyed off profiles.org)
--   * write — only owner/admin (via organization_members.role)
--
-- Safe today: handle_new_user() makes every self-signup user the 'owner' of their
-- personal org, and the backfill made all existing users 'owner'. Only accounts
-- explicitly added as 'member' via the admin portal are newly restricted from
-- writing org_settings — the customer settings UI is being updated to hide those
-- controls from non-owner/admin members (see src/routes/settings.tsx).

DROP POLICY IF EXISTS "org_settings_own_org"   ON public.org_settings;
DROP POLICY IF EXISTS "org_settings_read"       ON public.org_settings;
DROP POLICY IF EXISTS "org_settings_write"      ON public.org_settings;

-- Read: any member of the org (matches the prior read behaviour).
CREATE POLICY "org_settings_read" ON public.org_settings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.organization_id IS NOT NULL
        AND org_settings.organization_id = p.organization_id
    )
  );

-- Write (INSERT/UPDATE/DELETE): owner or admin of the org only. FOR ALL is fine
-- here — its SELECT branch is simply OR'd with the read policy above, while
-- INSERT/UPDATE/DELETE have no other applicable policy, so they require owner/admin.
CREATE POLICY "org_settings_write" ON public.org_settings
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.organization_id = org_settings.organization_id
        AND m.user_id = auth.uid()
        AND m.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.organization_id = org_settings.organization_id
        AND m.user_id = auth.uid()
        AND m.role IN ('owner', 'admin')
    )
  );
