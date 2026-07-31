-- H4 — enforce admin_audit_log append-only at the DATABASE level.
--
-- The table was documented as "append-only" but nothing prevented modification:
-- the admin-api uses the SERVICE-ROLE key, which bypasses RLS. RLS was therefore
-- no protection against the very credential that writes the log — a leaked/abused
-- service-role key (or any bug) could `DELETE FROM admin_audit_log` to erase the
-- record of impersonation / customer edits, defeating the whole accountability model.
--
-- Fix (belt-and-suspenders):
--   1. REVOKE UPDATE/DELETE/TRUNCATE from every app role. service_role bypasses
--      RLS but NOT table GRANTs, so this actually bites it. INSERT/SELECT stay.
--   2. A BEFORE UPDATE/DELETE trigger that RAISES — blocks even the table owner
--      (superuser bypasses triggers, but no runtime code connects as superuser).
--
-- Verified safe: admin-api only ever INSERTs (services/audit.py) and SELECTs
-- (routes/audit.py) this table; no retention/GDPR delete job exists.

REVOKE UPDATE, DELETE, TRUNCATE ON public.admin_audit_log FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'REVOKE UPDATE, DELETE, TRUNCATE ON public.admin_audit_log FROM service_role';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE UPDATE, DELETE, TRUNCATE ON public.admin_audit_log FROM authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE UPDATE, DELETE, TRUNCATE ON public.admin_audit_log FROM anon';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.admin_audit_log_block_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'admin_audit_log is append-only: % is not permitted', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS admin_audit_log_no_update_delete ON public.admin_audit_log;
CREATE TRIGGER admin_audit_log_no_update_delete
  BEFORE UPDATE OR DELETE ON public.admin_audit_log
  FOR EACH ROW EXECUTE FUNCTION public.admin_audit_log_block_mutation();
