-- Create api_usage_records table
CREATE TABLE IF NOT EXISTS public.api_usage_records (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    api_key       TEXT NOT NULL,
    caller_id     TEXT NOT NULL,
    called_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    success       BOOLEAN NOT NULL,
    latency_ms    INTEGER NOT NULL,
    endpoint      TEXT NOT NULL,
    credits_used  INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_api_usage_api_key ON public.api_usage_records(api_key);
CREATE INDEX IF NOT EXISTS idx_api_usage_caller_id ON public.api_usage_records(caller_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_called_at ON public.api_usage_records(called_at);

-- Enable RLS
ALTER TABLE public.api_usage_records ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to perform all actions (needed for frontend/backend interactions)
DROP POLICY IF EXISTS "allow_all_authenticated" ON public.api_usage_records;
CREATE POLICY "allow_all_authenticated" ON public.api_usage_records
    FOR ALL USING (auth.role() = 'authenticated');
