-- Per-copycat cases: track when each infringement was last updated.
-- The customer frontend now shows one case per copycat (instead of one case
-- per scan), and the dashboard computes per-copycat resolution trends — both
-- need a reliable per-row updated_at.

ALTER TABLE public.infringements
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Backfill existing rows with the best available timestamp.
UPDATE public.infringements
SET updated_at = COALESCE(flagged_at, created_at, now());

-- Keep updated_at fresh on every update.
-- Reuses update_updated_at() from 20260606000001_week2_schema.sql.
DROP TRIGGER IF EXISTS infringements_updated_at ON public.infringements;
CREATE TRIGGER infringements_updated_at
    BEFORE UPDATE ON public.infringements
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
