-- evidence_items: per-detection structured records with tiered scoring.
--
-- Replaces the dead infringement-scoped `evidence` table (20260618000002)
-- which conflicted with the live case-scoped `evidence` table (20260606000001).
-- The live case-scoped `evidence` table is untouched and remains the aggregate
-- JSONB store. This new table stores one row per individual detection with
-- structured tier scores, criteria breakdown, content hash for dedup, and
-- an embedding vector for semantic similarity.
--
-- Written by the updated persist_evidence() in persistence.py.
-- Read by GET /infringements/{id}/evidence (replaces the broken query).

CREATE TABLE IF NOT EXISTS public.evidence_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id         UUID REFERENCES public.cases(id) ON DELETE CASCADE,
    infringement_id UUID REFERENCES public.infringements(id) ON DELETE CASCADE,
    source_url      TEXT NOT NULL,
    platform        TEXT NOT NULL,
    screenshot_url  TEXT,
    content_hash    TEXT,
    tier0_score     FLOAT,
    tier1_score     FLOAT,
    tier2_score     FLOAT,
    overall_score   FLOAT,
    verdict         TEXT CHECK (verdict IN ('obvious_copycat', 'likely_copycat', 'ambiguous', 'obvious_non_match')),
    category        JSONB DEFAULT '[]',
    criteria        JSONB DEFAULT '[]',
    confidence      TEXT CHECK (confidence IN ('high', 'medium', 'low')),
    first_seen_at   TIMESTAMPTZ DEFAULT now(),
    scraped_at      TIMESTAMPTZ,
    status          TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'actioned')),
    embedding       VECTOR(768),
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_evidence_items_case         ON public.evidence_items(case_id);
CREATE INDEX IF NOT EXISTS idx_evidence_items_infringement  ON public.evidence_items(infringement_id);
CREATE INDEX IF NOT EXISTS idx_evidence_items_content_hash  ON public.evidence_items(content_hash);
CREATE INDEX IF NOT EXISTS idx_evidence_items_status        ON public.evidence_items(status);

-- ivfflat index for cosine similarity search on embeddings.
-- lists = 100 is a reasonable starting point for up to ~100k rows.
CREATE INDEX IF NOT EXISTS idx_evidence_items_embedding
    ON public.evidence_items USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

ALTER TABLE public.evidence_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "evidence_items_authenticated" ON public.evidence_items
    FOR ALL USING (auth.role() = 'authenticated');
