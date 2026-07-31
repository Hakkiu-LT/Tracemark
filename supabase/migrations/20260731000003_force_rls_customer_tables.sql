-- M5 — FORCE ROW LEVEL SECURITY on all customer-data tables.
--
-- Plain ENABLE RLS is bypassed by the table OWNER role (and any SECURITY DEFINER
-- function running as owner). FORCE closes that: only service_role (BYPASSRLS)
-- may skip policies. Verified safe — the customer app uses the anon/authenticated
-- key (subject to policies either way), both backends use the service-role key
-- (bypass FORCE), and backups run pg_dump as the postgres superuser (bypass FORCE).
-- No runtime code connects as the plain table owner.
--
-- NOTE for future data-migrations: DML run as the migration/owner role WILL now
-- be subject to RLS on these tables — use the service-role or a policy-aware path.

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'cases', 'evidence', 'decisions', 'infringements', 'takedown_reports',
    'documents', 'notification_deliveries', 'org_settings', 'clients',
    'brands', 'brand_assets', 'evidence_items', 'profiles'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
    END IF;
  END LOOP;
END $$;
