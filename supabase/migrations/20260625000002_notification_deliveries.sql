CREATE TABLE IF NOT EXISTS notification_deliveries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type      TEXT NOT NULL,
    infringement_id UUID REFERENCES infringements(id) ON DELETE SET NULL,
    payload         JSONB,
    status          TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'skipped')),
    error_message   TEXT,
    delivered_at    TIMESTAMPTZ DEFAULT now(),
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_deliveries_infringement ON notification_deliveries(infringement_id);
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_event_type ON notification_deliveries(event_type);
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_status ON notification_deliveries(status);

ALTER TABLE notification_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage notification deliveries"
    ON notification_deliveries FOR ALL
    USING (auth.role() = 'authenticated');
