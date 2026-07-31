-- M7 — make notification_deliveries read-only for customers.
--
-- The policy was FOR ALL, letting a customer UPDATE/DELETE their own org's email
-- delivery log (tamper with notification history). Customers only ever READ it
-- (src/.../notification-delivery-log.tsx); all writes come from the backend via
-- the service-role key (services/delivery_log.py), which bypasses RLS. So this
-- narrows the policy to FOR SELECT with the identical USING predicate.

DROP POLICY IF EXISTS "notification_deliveries_org_or_user" ON public.notification_deliveries;
CREATE POLICY "notification_deliveries_org_or_user" ON public.notification_deliveries
  FOR SELECT
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
