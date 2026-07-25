-- Multi-region scans: persist the country each infringement was actually
-- detected in. The scan pipeline already stamps every evidence item with the
-- scrape country (batch_detect fans out per country); this column lets
-- persist_infringement keep it so the UI can show the real region per copycat
-- instead of the case-level (first-selected) region.

ALTER TABLE public.infringements
    ADD COLUMN IF NOT EXISTS detection_region TEXT DEFAULT NULL;
