-- 012: record why an invoice email could not be delivered.
-- Additive and safe to re-run.

alter table public.invoices
  add column if not exists delivery_error text,
  add column if not exists delivery_attempted_at timestamptz;
