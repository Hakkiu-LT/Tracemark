-- Per-platform scraper health log. Append-only.
--
-- One row per platform (x country) each time a scraper runs — either during a real
-- customer scan (source='live', written from marketplace.batch_detect) or during the
-- daily lightweight reachability probe (source='probe', written from the main-API cron).
-- The Admin Portal "Scraper Health" page aggregates this into per-platform success
-- rate / latency / recent failures. Firecrawl credit usage is read separately from
-- api_usage_records (api_key='firecrawl').

CREATE TABLE IF NOT EXISTS public.scraper_health_log (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform       TEXT NOT NULL,        -- 'amazon' | 'ebay' | 'etsy' | 'shopify' | 'google_shopping'
                                         -- | 'alibaba' | 'aliexpress' | 'facebook_marketplace'
                                         -- | 'tiktok' | 'instagram' | 'google_ads' | 'meta_ads'
    country        TEXT,                 -- ISO-ish country code the scrape targeted (nullable)
    success        BOOLEAN NOT NULL,
    latency_ms     INTEGER NOT NULL DEFAULT 0,
    error_category TEXT,                 -- 'timeout' | 'blocked' | 'parse_error' | 'api_error' | 'http_error'
    error_detail   TEXT,                 -- truncated (~500 chars) exception message
    source         TEXT NOT NULL DEFAULT 'live',  -- 'live' (customer scan) | 'probe' (daily cron)
    checked_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS scraper_health_platform_idx ON public.scraper_health_log (platform, checked_at DESC);
CREATE INDEX IF NOT EXISTS scraper_health_checked_idx  ON public.scraper_health_log (checked_at DESC);

-- RLS: enabled, no permissive policy and no UPDATE/DELETE policy — append-only, and only
-- the service-role key writes to it (mirrors api_usage_records / admin_audit_log).
ALTER TABLE public.scraper_health_log ENABLE ROW LEVEL SECURITY;
