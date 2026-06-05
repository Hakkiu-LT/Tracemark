-- Week 2: Rebuild schema with updated column structure

-- Drop existing tables (CASCADE removes dependent triggers and policies)
DROP TABLE IF EXISTS public.decisions CASCADE;
DROP TABLE IF EXISTS public.evidence CASCADE;
DROP TABLE IF EXISTS public.cases CASCADE;
DROP FUNCTION IF EXISTS update_updated_at() CASCADE;

-- Cases table
CREATE TABLE public.cases (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_name      TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending',
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now(),
    organization_id UUID
);

-- Evidence table
CREATE TABLE public.evidence (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id             UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
    marketplaces        JSONB DEFAULT '[]',
    ads                 JSONB DEFAULT '[]',
    domains             JSONB DEFAULT '[]',
    social              JSONB DEFAULT '[]',
    raw_scrape_metadata JSONB DEFAULT '{}',
    created_at          TIMESTAMPTZ DEFAULT now()
);

-- Decisions table
CREATE TABLE public.decisions (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id            UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
    risk_level         TEXT NOT NULL,
    recommended_action TEXT NOT NULL,
    case_summary       TEXT NOT NULL,
    confidence_score   FLOAT NOT NULL DEFAULT 0.0,
    evidence_quality   TEXT,
    key_findings       JSONB DEFAULT '[]',
    gemini_model       TEXT DEFAULT 'gemini-2.5-pro',
    created_at         TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cases_brand    ON public.cases(brand_name);
CREATE INDEX IF NOT EXISTS idx_decisions_risk ON public.decisions(risk_level);
CREATE INDEX IF NOT EXISTS idx_evidence_case  ON public.evidence(case_id);

-- Updated_at trigger for cases
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER cases_updated_at
BEFORE UPDATE ON public.cases
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE public.cases     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_authenticated" ON public.cases
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "allow_all_authenticated" ON public.evidence
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "allow_all_authenticated" ON public.decisions
  FOR ALL USING (auth.role() = 'authenticated');
