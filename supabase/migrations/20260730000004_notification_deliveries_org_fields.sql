-- Enrich notification_deliveries into a full email log.
--
-- The table previously reached org context only via the join chain
-- infringement_id -> cases.id -> cases.organization_id, and never stored who an
-- email went to or its subject. This adds three direct columns so the Admin
-- Portal "Notification Log" can show recipient + subject + organization per row:
--   organization_id  — resolved at write time (or backfilled below)
--   recipient        — the email address the message was sent to
--   subject          — the email subject line
--
-- All three are NULLABLE: platform-directed takedown notices and `test` emails
-- have no derivable customer org, and historical rows never captured recipient/
-- subject. New writes populate them going forward (services/delivery_log.py).

-- 1) Additive columns (safe against the currently-running old code) ------------
ALTER TABLE public.notification_deliveries
    ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE public.notification_deliveries
    ADD COLUMN IF NOT EXISTS recipient TEXT;
ALTER TABLE public.notification_deliveries
    ADD COLUMN IF NOT EXISTS subject TEXT;

-- 2) Backfill organization_id for existing rows -------------------------------
--    Primary path: infringement_id -> case -> org.
UPDATE public.notification_deliveries nd
SET organization_id = c.organization_id
FROM public.infringements i
JOIN public.cases c ON c.id = i.case_id
WHERE nd.infringement_id = i.id
  AND nd.organization_id IS NULL;

--    Fallback: rows with no infringement_id but a payload-embedded case_id
--    (e.g. case_escalated / case_dismissed events).
UPDATE public.notification_deliveries nd
SET organization_id = c.organization_id
FROM public.cases c
WHERE nd.infringement_id IS NULL
  AND nd.organization_id IS NULL
  AND (nd.payload ->> 'case_id') IS NOT NULL
  AND c.id::text = nd.payload ->> 'case_id';

-- 3) Index for org-scoped reads -----------------------------------------------
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_organization
    ON public.notification_deliveries(organization_id);

-- 4) RLS: add a direct organization_id branch (defense-in-depth) --------------
--    Customers still only see their own org's rows; admin-api uses the
--    service-role key and bypasses RLS entirely. The original infringement->
--    case chain is preserved; the new branch also covers rows that carry a
--    direct organization_id but no infringement (e.g. weekly digest, welcome).
DROP POLICY IF EXISTS "notification_deliveries_org_or_user" ON public.notification_deliveries;
CREATE POLICY "notification_deliveries_org_or_user" ON public.notification_deliveries
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.infringements i
      JOIN public.cases c ON c.id = i.case_id
      LEFT JOIN public.profiles p ON p.id = auth.uid()
      WHERE i.id = notification_deliveries.infringement_id
        AND (
          (p.organization_id IS NOT NULL AND c.organization_id = p.organization_id)
          OR c.user_id = auth.uid()
        )
    )
    OR (
      notification_deliveries.organization_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.organization_id IS NOT NULL
          AND p.organization_id = notification_deliveries.organization_id
      )
    )
  );
