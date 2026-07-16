-- brand_assets: reference assets for a brand used by Tier 1 similarity scoring.
--
-- Stores logos, reference site content, and product images that the detection
-- funnel compares scraped candidates against. Each asset can carry:
-- - file_url:     Supabase Storage URL in the brand-assets bucket
-- - content_hash: SHA-256 for dedup / change detection
-- - phash:        64-bit perceptual hash (as bigint) for fast image comparison
-- - embedding:    768-dim vector for semantic similarity (pgvector)
--
-- Uploaded via the new brand asset endpoints in routes/brands.py.

CREATE TABLE IF NOT EXISTS public.brand_assets (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id        UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    asset_type      TEXT NOT NULL CHECK (asset_type IN ('logo', 'reference_content', 'product_image')),
    file_url        TEXT,
    content_hash    TEXT,
    phash           BIGINT,
    embedding       VECTOR(768),
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brand_assets_brand ON public.brand_assets(brand_id);
CREATE INDEX IF NOT EXISTS idx_brand_assets_type  ON public.brand_assets(brand_id, asset_type);

CREATE INDEX IF NOT EXISTS idx_brand_assets_embedding
    ON public.brand_assets USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

ALTER TABLE public.brand_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brand_assets_authenticated" ON public.brand_assets
    FOR ALL USING (auth.role() = 'authenticated');
