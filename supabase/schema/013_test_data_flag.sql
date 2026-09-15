-- 013_test_data_flag.sql
-- Marks the existing book of work as test data ahead of going live on PayPal.
-- New projects default to real (is_test = false).

alter table public.quotes add column if not exists is_test boolean not null default false;
create index if not exists idx_quotes_is_test on public.quotes(is_test);

-- One-time switch-over: everything that exists today becomes test data.
update public.quotes set is_test = true where is_test = false;
