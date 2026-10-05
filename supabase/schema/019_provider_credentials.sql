-- 019_provider_credentials.sql
-- Provider keys and settings managed from the admin dashboard.
-- Server-only: no anon/authenticated access. Values override environment variables.
-- Run once in the Supabase SQL editor.

create table if not exists public.provider_credentials (
  name text primary key,
  value text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

revoke all on public.provider_credentials from anon, authenticated;
grant all on public.provider_credentials to service_role;

alter table public.provider_credentials enable row level security;
-- No policies on purpose: only the service role (server code) can reach this table.
