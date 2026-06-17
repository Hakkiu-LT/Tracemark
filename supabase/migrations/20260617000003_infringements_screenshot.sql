ALTER TABLE public.infringements
  ADD COLUMN IF NOT EXISTS screenshot_url TEXT;
