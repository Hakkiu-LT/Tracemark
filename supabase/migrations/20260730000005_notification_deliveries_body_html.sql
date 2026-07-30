-- Store the rendered HTML body of each notification so the Admin Portal can
-- show the actual email a recipient received (not just metadata/payload).
--
-- Nullable: historical rows never captured the body, and skipped/failed sends
-- may have no body. New sends populate it (services/delivery_log.py).
ALTER TABLE public.notification_deliveries
    ADD COLUMN IF NOT EXISTS body_html TEXT;
