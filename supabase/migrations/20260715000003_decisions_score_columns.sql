-- Add per-category score columns to the decisions table.
--
-- The save_decision() function in database.py already writes these columns
-- (line 66-72), but no migration ever added them — the branch was dead.
-- This makes the branch live and adds a criteria_scores JSONB for the
-- full per-criterion breakdown from the tiered funnel.

ALTER TABLE public.decisions
    ADD COLUMN IF NOT EXISTS evidence_score    FLOAT,
    ADD COLUMN IF NOT EXISTS marketplace_score FLOAT,
    ADD COLUMN IF NOT EXISTS ads_score         FLOAT,
    ADD COLUMN IF NOT EXISTS domains_score     FLOAT,
    ADD COLUMN IF NOT EXISTS social_score      FLOAT,
    ADD COLUMN IF NOT EXISTS criteria_scores   JSONB DEFAULT '[]';
