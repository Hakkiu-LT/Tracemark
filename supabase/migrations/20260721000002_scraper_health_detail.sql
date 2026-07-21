-- Add "what was scanned" context to scraper_health_log so staff can drill into
-- individual scrape events (which brand, triggered by whom).
ALTER TABLE public.scraper_health_log
  ADD COLUMN IF NOT EXISTS brand_name TEXT,
  ADD COLUMN IF NOT EXISTS caller_id  TEXT;
