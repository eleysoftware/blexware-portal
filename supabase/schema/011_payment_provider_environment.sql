-- 011_payment_provider_environment.sql
-- Payment provider + environment tracking. Adds generic provider columns to
-- invoice_payments and refunds, stores the active provider/environment in
-- app_settings, and backfills existing Hyperswitch rows.

-- Generic provider reference for invoice_payments.
alter table public.invoice_payments add column if not exists provider text not null default 'hyperswitch';
alter table public.invoice_payments add column if not exists environment text not null default 'sandbox';
alter table public.invoice_payments add column if not exists provider_payment_id text;

-- Backfill provider_payment_id from the legacy Hyperswitch id.
update public.invoice_payments
set provider_payment_id = coalesce(provider_payment_id, hyperswitch_payment_id)
where provider_payment_id is null and hyperswitch_payment_id is not null;

-- Generic provider reference for refunds.
alter table public.refunds add column if not exists provider text not null default 'hyperswitch';
alter table public.refunds add column if not exists environment text not null default 'sandbox';
alter table public.refunds add column if not exists provider_refund_id text;

-- Backfill provider_refund_id from the legacy Hyperswitch id.
update public.refunds
set provider_refund_id = coalesce(provider_refund_id, hyperswitch_refund_id)
where provider_refund_id is null and hyperswitch_refund_id is not null;

-- Indexes for webhook reconciliation and admin lookups.
create index if not exists idx_invoice_payments_provider_payment_id on public.invoice_payments(provider_payment_id);
create index if not exists idx_invoice_payments_provider_environment on public.invoice_payments(provider, environment);
create index if not exists idx_refunds_provider_refund_id on public.refunds(provider_refund_id);

-- Active provider/environment settings. These are read by the payment service
-- and can be switched from the admin dashboard.
insert into public.app_settings (key, value, updated_at)
values
  ('payment_provider', '"hyperswitch"', now()),
  ('payment_environment', '"sandbox"', now())
on conflict (key) do update set
  value = excluded.value,
  updated_at = now();
