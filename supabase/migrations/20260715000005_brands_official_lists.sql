-- Add official_domains and official_advertisers to the brands table.
-- These store per-brand whitelists used by the detection funnel to filter
-- out legitimate listings, ads, and domains before scoring.

ALTER TABLE public.brands
    ADD COLUMN IF NOT EXISTS official_domains     TEXT[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS official_advertisers TEXT[] DEFAULT '{}';
