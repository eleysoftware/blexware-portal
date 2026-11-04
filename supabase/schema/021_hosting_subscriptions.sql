-- Yearly service subscriptions (e.g. web hosting) with optional PayPal auto-renew.
-- Run manually in the Supabase SQL editor.

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  service_name text not null default 'Web Hosting',
  amount_cents bigint not null check (amount_cents > 0),
  currency text not null default 'USD',
  billing_interval text not null default 'year',
  status text not null default 'pending'
    check (status in ('pending', 'active', 'past_due', 'cancelled')),
  auto_renew boolean not null default false,
  provider text,
  provider_subscription_id text,
  provider_environment text,
  activation_invoice_id uuid,
  start_date date not null default current_date,
  renewal_date date not null,
  last_notice_for date,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscriptions_quote_idx on public.subscriptions (quote_id);
create index if not exists subscriptions_renewal_idx on public.subscriptions (status, renewal_date);
create unique index if not exists subscriptions_provider_sub_idx
  on public.subscriptions (provider_subscription_id) where provider_subscription_id is not null;

revoke all on public.subscriptions from anon, authenticated;
grant all on public.subscriptions to service_role;
alter table public.subscriptions enable row level security;
-- No policies: only server code (service role) reads or writes subscriptions.

drop trigger if exists subscriptions_touch on public.subscriptions;
create trigger subscriptions_touch before update on public.subscriptions
  for each row execute function public.touch_updated_at();

alter table public.invoices
  add column if not exists subscription_id uuid references public.subscriptions(id) on delete set null,
  add column if not exists subscription_period_end date;

create index if not exists invoices_subscription_idx on public.invoices (subscription_id);
