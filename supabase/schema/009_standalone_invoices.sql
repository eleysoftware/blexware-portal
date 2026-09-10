-- 009_standalone_invoices.sql
-- Direct invoicing: bill a client without a quote/proposal/estimate/SOW behind it.
-- Invoices created this way have no agreement, and carry their own itemised lines.

alter table public.invoices alter column agreement_id drop not null;

alter table public.invoices add column if not exists line_items jsonb not null default '[]'::jsonb;
alter table public.invoices add column if not exists subtotal_cents bigint not null default 0;
alter table public.invoices add column if not exists discount_cents bigint not null default 0;
