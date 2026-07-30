-- Multi-slot booking: a Book-a-demo visitor now proposes SEVERAL times they're
-- free, and staff pick the one that suits us. `proposed_slots` holds the offered
-- times; `scheduled_at` (added in 20260730000002) becomes the FINAL slot staff
-- confirm from that list.
--
--   proposed_slots = ["2026-08-13T07:00:00Z", "2026-08-14T09:30:00Z", ...]  (UTC ISO strings)
--   scheduled_at   = the single slot staff confirmed (null until confirmed)

alter table public.sales_leads
  add column if not exists proposed_slots jsonb;

comment on column public.sales_leads.proposed_slots is
  'Array of UTC ISO datetimes the visitor offered as their availability. Staff confirm one into scheduled_at.';
