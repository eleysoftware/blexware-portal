-- Admin-only key/value settings store.
-- Currently holds which invoice payment methods are offered to clients.
-- Run once in the Supabase SQL editor.

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

grant select, insert, update on public.app_settings to authenticated;
grant all on public.app_settings to service_role;

alter table public.app_settings enable row level security;

drop policy if exists "Admins read settings" on public.app_settings;
create policy "Admins read settings" on public.app_settings
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "Admins insert settings" on public.app_settings;
create policy "Admins insert settings" on public.app_settings
  for insert to authenticated
  with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "Admins update settings" on public.app_settings;
create policy "Admins update settings" on public.app_settings
  for update to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- Card is live today; bank (ACH) stays off until the connector is approved.
insert into public.app_settings (key, value)
values ('payment_methods', '{"card": true, "bank": false}'::jsonb)
on conflict (key) do nothing;
