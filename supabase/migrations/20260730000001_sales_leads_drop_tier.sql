-- Remove the "tier" concept from sales_leads.
--
-- HAKKIU no longer has Professional/Enterprise tiers. The Book-a-demo and
-- Talk-to-sales forms were hardcoding a fake tier ('professional' / 'enterprise')
-- that the visitor never chose — and it leaked into the staff notification email
-- (subject + "Tier" row) and the Admin Portal (Tier column, badge, filter).
--
-- A lead's true origin is already captured by `source`
-- ('request_demo' / 'call_request'), so tier is redundant. We keep the column so
-- historical rows are preserved, but relax it (nullable, no CHECK) so new leads
-- can omit it entirely and nothing has to invent a value.

alter table public.sales_leads
    drop constraint if exists sales_leads_tier_check;

alter table public.sales_leads
    alter column tier drop not null;
