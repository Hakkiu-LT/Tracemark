-- Migration to support Law Firm Mode & Clients
-- 1. Alter org_settings to support persona
ALTER TABLE public.org_settings ADD COLUMN IF NOT EXISTS persona TEXT NOT NULL DEFAULT 'brand_owner' CHECK (persona IN ('brand_owner', 'law_firm'));

-- 2. Create clients table
CREATE TABLE IF NOT EXISTS public.clients (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          TEXT NOT NULL,
    industry      TEXT,
    plan          TEXT NOT NULL DEFAULT 'Pro',
    mrr           INTEGER NOT NULL DEFAULT 0,
    contact       TEXT,
    organization_id UUID,
    created_at    TIMESTAMPTZ DEFAULT now(),
    updated_at    TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on clients
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- Policy for clients
CREATE POLICY "allow_all_authenticated" ON public.clients
    FOR ALL USING (auth.role() = 'authenticated');

-- 3. Add client_id columns to cases and infringements
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL;
ALTER TABLE public.infringements ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL;
