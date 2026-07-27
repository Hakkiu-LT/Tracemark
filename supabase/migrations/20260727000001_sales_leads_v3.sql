-- Enrich sales_leads with pre-demo qualification fields captured by the
-- /request-demo wizard so the team can research a prospect BEFORE the call.
--
-- All new columns are nullable (only website + role are required in the UI;
-- the rest are optional) so existing rows and the call-request / pricing
-- forms keep working unchanged.

alter table public.sales_leads
    add column if not exists role             text,   -- job title / role of the contact
    add column if not exists website          text,   -- company website / domain
    add column if not exists phone            text,   -- optional phone number
    add column if not exists regions          text[], -- markets they sell in (multi)
    add column if not exists brand_names      text,   -- free-text list of brands to protect
    add column if not exists marketplaces     text[], -- marketplaces where they see abuse (multi)
    add column if not exists current_solution text,   -- how they handle it today (single)
    add column if not exists primary_goal     text[]; -- what they want to solve (multi)
