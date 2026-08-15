-- BLEXware payments on Hyperswitch (replaces the Stripe-specific fields).
-- Run once in the Supabase SQL editor.

-- ------------------------------------------------------- invoice statuses
alter type public.invoice_status add value if not exists 'draft';
alter type public.invoice_status add value if not exists 'viewed';
alter type public.invoice_status add value if not exists 'partially_paid';
alter type public.invoice_status add value if not exists 'overdue';
alter type public.invoice_status add value if not exists 'cancelled';

commit;

-- --------------------------------------------------------------- invoices
alter table public.invoices drop column if exists stripe_session_id;
alter table public.invoices drop column if exists stripe_payment_intent;
alter table public.invoices add column if not exists issue_date date;
alter table public.invoices add column if not exists currency text not null default 'usd';
alter table public.invoices add column if not exists amount_paid_cents bigint not null default 0;
alter table public.invoices add column if not exists description text;
alter table public.invoices add column if not exists viewed_at timestamptz;

-- ------------------------------------------------------- invoice_payments
create table if not exists public.invoice_payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  payment_reference text not null unique default encode(extensions.gen_random_bytes(12), 'hex'),
  hyperswitch_payment_id text unique,
  hyperswitch_connector text,
  amount_cents bigint not null,
  currency text not null default 'usd',
  payment_method text,
  status text not null default 'created',
  processor_transaction_id text,
  failure_code text,
  failure_message text,
  fees jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists invoice_payments_invoice_idx on public.invoice_payments (invoice_id);

grant select on public.invoice_payments to authenticated;
grant all on public.invoice_payments to service_role;
alter table public.invoice_payments enable row level security;

drop trigger if exists invoice_payments_touch_updated_at on public.invoice_payments;
create trigger invoice_payments_touch_updated_at before update on public.invoice_payments
  for each row execute function public.touch_updated_at();

drop policy if exists "Admins read invoice payments" on public.invoice_payments;
create policy "Admins read invoice payments" on public.invoice_payments
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "Clients read own invoice payments" on public.invoice_payments;
create policy "Clients read own invoice payments" on public.invoice_payments
  for select to authenticated using (
    exists (
      select 1 from public.invoices i
      join public.quotes q on q.id = i.quote_id
      where i.id = invoice_payments.invoice_id
        and q.deleted_at is null
        and public.viewer_email() is not null
        and lower(q.contact_email) = public.viewer_email()
    )
  );

drop policy if exists "No client writes on invoice payments" on public.invoice_payments;
create policy "No client writes on invoice payments" on public.invoice_payments
  for insert to anon, authenticated with check (false);

-- --------------------------------------------------------- payment_events
create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  invoice_payment_id uuid references public.invoice_payments(id) on delete cascade,
  event_type text not null,
  event_id text not null unique,
  event_payload jsonb not null default '{}'::jsonb,
  signature_verified boolean not null default false,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);
create index if not exists payment_events_payment_idx on public.payment_events (invoice_payment_id);

grant select on public.payment_events to authenticated;
grant all on public.payment_events to service_role;
alter table public.payment_events enable row level security;

drop policy if exists "Admins read payment events" on public.payment_events;
create policy "Admins read payment events" on public.payment_events
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "No client writes on payment events" on public.payment_events;
create policy "No client writes on payment events" on public.payment_events
  for insert to anon, authenticated with check (false);

-- ----------------------------------------------------------------- refunds
create table if not exists public.refunds (
  id uuid primary key default gen_random_uuid(),
  invoice_payment_id uuid not null references public.invoice_payments(id) on delete cascade,
  amount_cents bigint not null,
  reason text,
  initiated_by uuid,
  initiated_label text,
  hyperswitch_refund_id text unique,
  processor_refund_id text,
  status text not null default 'created',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists refunds_payment_idx on public.refunds (invoice_payment_id);

grant select on public.refunds to authenticated;
grant all on public.refunds to service_role;
alter table public.refunds enable row level security;

drop trigger if exists refunds_touch_updated_at on public.refunds;
create trigger refunds_touch_updated_at before update on public.refunds
  for each row execute function public.touch_updated_at();

drop policy if exists "Admins read refunds" on public.refunds;
create policy "Admins read refunds" on public.refunds
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "Clients read own refunds" on public.refunds;
create policy "Clients read own refunds" on public.refunds
  for select to authenticated using (
    exists (
      select 1 from public.invoice_payments p
      join public.invoices i on i.id = p.invoice_id
      join public.quotes q on q.id = i.quote_id
      where p.id = refunds.invoice_payment_id
        and q.deleted_at is null
        and public.viewer_email() is not null
        and lower(q.contact_email) = public.viewer_email()
    )
  );

drop policy if exists "No client writes on refunds" on public.refunds;
create policy "No client writes on refunds" on public.refunds
  for insert to anon, authenticated with check (false);

-- The legacy Stripe payments table is retired; keep it read-only for audit.
-- drop table if exists public.payments;  -- run manually once migrated
