-- Migration to support user notification email settings
CREATE TABLE IF NOT EXISTS public.org_settings (
    organization_id    UUID PRIMARY KEY,
    notification_email TEXT NOT NULL,
    created_at         TIMESTAMPTZ DEFAULT now(),
    updated_at         TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.org_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_authenticated" ON public.org_settings
    FOR ALL USING (auth.role() = 'authenticated');
