-- Fix brand_count_range constraint to match frontend values,
-- make name/company nullable for call-request leads,
-- and add a source column to distinguish form origins.

-- 1. Drop the old CHECK constraint on brand_count_range
alter table public.sales_leads
    drop constraint if exists sales_leads_brand_count_range_check;

-- 2. Make brand_count_range nullable (call requests don't have it)
alter table public.sales_leads
    alter column brand_count_range drop not null;

-- 3. Add new CHECK that covers all frontend values (plus NULL)
alter table public.sales_leads
    add constraint sales_leads_brand_count_range_check
    check (brand_count_range is null or brand_count_range in ('1', '2-3', '4-5', '6-10', '11-20', '20+'));

-- 4. Make first_name, last_name, company nullable (call requests omit these)
alter table public.sales_leads
    alter column first_name drop not null;
alter table public.sales_leads
    alter column last_name drop not null;
alter table public.sales_leads
    alter column company drop not null;

-- 5. Add source column to distinguish form origins
--    'pricing_modal'  = Request Pricing button on pricing page
--    'request_demo'   = /request-demo wizard
--    'call_request'   = TalkToSalesModal ("Receive a free call")
alter table public.sales_leads
    add column if not exists source text
    check (source is null or source in ('pricing_modal', 'request_demo', 'call_request'));
