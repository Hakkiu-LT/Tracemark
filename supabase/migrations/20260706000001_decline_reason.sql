-- Migration to support decline reason and drop constraint
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS decline_reason TEXT DEFAULT NULL;
ALTER TABLE public.infringements ADD COLUMN IF NOT EXISTS decline_reason TEXT DEFAULT NULL;

-- Drop check constraints on status for infringements to support advanced statuses (complete, declined, etc.)
ALTER TABLE public.infringements DROP CONSTRAINT IF EXISTS infringements_status_check;
