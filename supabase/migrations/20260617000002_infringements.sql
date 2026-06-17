-- Phase 2: Infringements table
-- Stores individual flagged items detected by the detection engine.
-- Each infringement links to a case and records what was found, where, and how risky.

CREATE TABLE public.infringements (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id      UUID REFERENCES public.cases(id) ON DELETE SET NULL,
    source_url   TEXT NOT NULL,
    platform     TEXT NOT NULL,
    risk_level   TEXT NOT NULL CHECK (risk_level IN ('HIGH', 'MEDIUM', 'LOW')),
    match_score  FLOAT NOT NULL DEFAULT 0.0,
    match_type   TEXT NOT NULL DEFAULT 'keyword' CHECK (match_type IN ('keyword', 'image', 'both')),
    status       TEXT NOT NULL DEFAULT 'flagged' CHECK (status IN ('flagged', 'reviewed', 'dismissed')),
    flagged_at   TIMESTAMPTZ DEFAULT now(),
    created_at   TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_infringements_case       ON public.infringements(case_id);
CREATE INDEX IF NOT EXISTS idx_infringements_risk       ON public.infringements(risk_level);
CREATE INDEX IF NOT EXISTS idx_infringements_status     ON public.infringements(status);
CREATE INDEX IF NOT EXISTS idx_infringements_source_url ON public.infringements(source_url);

-- RLS
ALTER TABLE public.infringements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "infringements_authenticated" ON public.infringements
  FOR ALL USING (auth.role() = 'authenticated');
