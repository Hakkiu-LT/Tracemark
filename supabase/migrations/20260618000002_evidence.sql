-- Evidence table: stores one captured screenshot + optional AI analysis
-- per infringement. Separate from the infringements table so a single
-- infringement can accumulate multiple evidence snapshots over time.

CREATE TABLE public.evidence (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    infringement_id UUID NOT NULL REFERENCES public.infringements(id) ON DELETE CASCADE,
    screenshot_url  TEXT,
    ai_analysis     JSONB,
    captured_at     TIMESTAMPTZ DEFAULT now(),
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_evidence_infringement ON public.evidence(infringement_id);

ALTER TABLE public.evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "evidence_authenticated" ON public.evidence
    FOR ALL USING (auth.role() = 'authenticated');
