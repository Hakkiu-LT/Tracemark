-- Demo scheduling: let a Book-a-demo lead carry a requested date/time and let
-- staff confirm it with a meeting link. All columns are nullable so existing
-- rows and non-demo leads (Talk-to-sales) are unaffected.
--
-- Booking state is DERIVED, not stored:
--   scheduled_at IS NOT NULL AND confirmed_at IS NULL  -> "requested" (awaiting staff)
--   confirmed_at IS NOT NULL                           -> "confirmed" (email sent)
--   scheduled_at IS NULL                               -> no slot picked (legacy / call_request)

alter table public.sales_leads
  add column if not exists scheduled_at       timestamptz,  -- requested slot, stored in UTC
  add column if not exists scheduled_timezone text,         -- IANA tz the visitor saw (e.g. "Europe/Vilnius")
  add column if not exists meeting_link        text,        -- video link staff enters when confirming
  add column if not exists confirmed_at        timestamptz; -- when staff confirmed + emailed the customer

comment on column public.sales_leads.scheduled_at is
  'Requested demo slot (UTC). Set by the Book-a-demo scheduler; it is a request, not a locked booking.';
comment on column public.sales_leads.scheduled_timezone is
  'IANA timezone the visitor selected the slot in, so staff/emails can render the local wall-clock time.';
comment on column public.sales_leads.meeting_link is
  'Video meeting URL staff paste when confirming; delivered to the customer in the confirmation email.';
comment on column public.sales_leads.confirmed_at is
  'When staff confirmed the slot and the confirmation email was sent (UTC). Null = still a request.';
