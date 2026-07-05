-- Store requested target regions on the case (historically)
ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS target_regions TEXT[] DEFAULT '{US}';

-- Tag each case with its specific 2-letter ISO country code (e.g., 'US', 'CA', 'DE')
ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS detection_region TEXT DEFAULT NULL;
