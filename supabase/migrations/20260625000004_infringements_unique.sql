-- Add unique constraint to infringements table to support on_conflict upsert on case_id + source_url
ALTER TABLE public.infringements
    ADD CONSTRAINT unique_case_source_url UNIQUE (case_id, source_url);
