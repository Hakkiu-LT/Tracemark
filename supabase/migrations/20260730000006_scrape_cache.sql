-- scrape_cache: cross-scan, URL-keyed cache of scraped page content.
--
-- Avoids re-scraping (and, for Firecrawl, re-paying credits for) URLs already
-- fetched recently — the same page is reused from the cache within its TTL.
-- Pure operational infrastructure (like the in-memory _js_cache and the Tranco
-- whitelist cache) — not customer data, so it has no Admin Portal surface.
--
-- Read/written by the API service role only; RLS denies all anon/authenticated
-- access (RLS is bypassed by the service role, which is the only writer).

CREATE TABLE IF NOT EXISTS public.scrape_cache (
    url_hash     TEXT PRIMARY KEY,            -- sha256(normalized url) — stable across token rotation
    url          TEXT NOT NULL,               -- normalized url (human-readable, for ops/debugging)
    content_hash TEXT,                         -- sha256(markdown) for change detection (optional)
    markdown     TEXT NOT NULL,                -- post-fetch markdown fed back to the detection funnel
    title        TEXT,
    scraper_used TEXT NOT NULL,                -- 'static' | 'js'
    scraped_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scrape_cache_scraped_at ON public.scrape_cache(scraped_at);

ALTER TABLE public.scrape_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "scrape_cache_service_only" ON public.scrape_cache;
CREATE POLICY "scrape_cache_service_only" ON public.scrape_cache
    FOR ALL USING (false) WITH CHECK (false);