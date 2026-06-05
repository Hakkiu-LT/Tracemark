-- cases table
CREATE TABLE public.cases (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_name      TEXT NOT NULL,
  platforms       TEXT[] DEFAULT '{}',
  status          TEXT CHECK (status IN ('open', 'takedown_sent', 'resolved', 'marked_safe')) DEFAULT 'open',
  risk_level      TEXT CHECK (risk_level IN ('high', 'medium', 'low')),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- evidence table
CREATE TABLE public.evidence (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id     UUID REFERENCES public.cases(id) ON DELETE CASCADE,
  payload     JSONB NOT NULL,
  scraped_at  TIMESTAMPTZ DEFAULT now()
);

-- decisions table
CREATE TABLE public.decisions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id         UUID REFERENCES public.cases(id) ON DELETE CASCADE,
  recommendation  TEXT CHECK (recommendation IN ('YES', 'NO')) NOT NULL,
  confidence      INT CHECK (confidence >= 0 AND confidence <= 100),
  reasoning       TEXT,
  case_summary    TEXT,
  priority        TEXT CHECK (priority IN ('HIGH', 'MEDIUM', 'LOW')),
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- auto-update updated_at on cases
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
