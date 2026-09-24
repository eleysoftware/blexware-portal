-- 018: text-message consent on clients and text-reminder tracking on invoices.
-- Additive and safe to re-run. Run once in the Supabase SQL editor.

alter table public.quotes
  add column if not exists sms_opt_in boolean not null default false,
  add column if not exists sms_opt_in_at timestamptz;

alter table public.invoices
  add column if not exists sms_reminder_count integer not null default 0,
  add column if not exists last_sms_reminder_at timestamptz;
