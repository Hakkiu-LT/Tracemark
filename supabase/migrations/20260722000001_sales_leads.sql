-- Sales leads captured from the "Request Pricing" / "Request Demo" form on the
-- Professional and Enterprise pricing cards.  Public insert (anon role via API),
-- staff read/update via admin-api (service-role).

create type public.sales_lead_status as enum ('pending', 'contacted', 'closed');

create table public.sales_leads (
    id          uuid primary key default gen_random_uuid(),
    -- org_id is null when the visitor is not yet a customer
    org_id      uuid references public.organizations(id) on delete set null,
    tier        text not null check (tier in ('professional', 'enterprise')),
    first_name  text not null,
    last_name   text not null,
    email       text not null,
    company     text not null,
    brand_count_range text not null check (brand_count_range in ('1-5', '6-20', '20+')),
    message     text,
    status      public.sales_lead_status not null default 'pending',
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

-- staff reads this via service-role key (bypasses RLS), but protect anon from reading
alter table public.sales_leads enable row level security;

-- nobody can read leads via the customer-facing anon key
create policy "no anon read" on public.sales_leads
    for select using (false);

-- the main API inserts via service-role (bypasses RLS) so no insert policy needed

create index sales_leads_status_idx  on public.sales_leads (status);
create index sales_leads_created_idx on public.sales_leads (created_at desc);

-- keep updated_at fresh on every update
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create trigger sales_leads_updated_at
    before update on public.sales_leads
    for each row execute function public.set_updated_at();
