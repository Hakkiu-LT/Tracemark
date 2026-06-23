-- Add notification_sent_at to infringements.
-- Tracks when an email notification was last sent for this infringement,
-- so the notification service can skip already-notified rows.

ALTER TABLE public.infringements
    ADD COLUMN IF NOT EXISTS notification_sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_infringements_notification_sent_at
    ON public.infringements(notification_sent_at)
    WHERE notification_sent_at IS NULL;
