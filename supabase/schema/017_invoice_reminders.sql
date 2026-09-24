-- 017: track recurring unpaid-invoice reminders.
-- Additive and safe to re-run. Existing invoice grants and RLS remain unchanged.

alter table public.invoices
  add column if not exists last_reminder_at timestamptz,
  add column if not exists reminder_count integer not null default 0;

comment on column public.invoices.last_reminder_at is
  'Last successful unpaid-balance reminder delivery.';
comment on column public.invoices.reminder_count is
  'Number of successful unpaid-balance reminder deliveries.';