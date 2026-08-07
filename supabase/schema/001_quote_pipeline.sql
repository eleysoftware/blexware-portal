-- BLEXware quote pipeline schema
-- Run this once in the Supabase SQL editor for the BLEXware_site project.

-- ---------------------------------------------------------------- roles
do $$ begin
  create type public.app_role as enum ('admin', 'staff', 'user');
exception when duplicate_object then null; end $$;

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

revoke all on function public.has_role(uuid, public.app_role) from public, anon;
grant execute on function public.has_role(uuid, public.app_role) to authenticated, service_role;

drop policy if exists "Users read own roles" on public.user_roles;
create policy "Users read own roles" on public.user_roles
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "Admins read all roles" on public.user_roles;
create policy "Admins read all roles" on public.user_roles
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));

-- --------------------------------------------------------------- quotes
do $$ begin
  create type public.quote_status as enum (
    'new', 'reviewing', 'proposal_draft', 'proposal_sent', 'approved', 'declined'
  );
exception when duplicate_object then null; end $$;

create sequence if not exists public.quote_number_seq;

create or replace function public.next_quote_number()
returns text
language sql
volatile
security definer
set search_path = public
as $$
  select 'BLX-' || to_char(now(), 'YYYY') || '-' ||
         lpad(nextval('public.quote_number_seq')::text, 4, '0')
$$;

revoke all on function public.next_quote_number() from public, anon, authenticated;
grant execute on function public.next_quote_number() to service_role;

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  quote_number text not null unique default public.next_quote_number(),
  status public.quote_status not null default 'new',
  project_type text not null,
  industry text not null,
  services text[] not null default '{}',
  goals text not null,
  features text,
  budget text not null,
  timeline text not null,
  contact_name text not null,
  contact_email text not null,
  company text,
  phone text,
  consent boolean not null default false,
  source_ip text,
  internal_notes text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists quotes_status_idx on public.quotes (status);
create index if not exists quotes_created_at_idx on public.quotes (created_at desc);
create index if not exists quotes_email_idx on public.quotes (contact_email);

grant select, update on public.quotes to authenticated;
grant all on public.quotes to service_role;
alter table public.quotes enable row level security;

drop policy if exists "Admins read quotes" on public.quotes;
create policy "Admins read quotes" on public.quotes
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "Admins update quotes" on public.quotes;
create policy "Admins update quotes" on public.quotes
  for update to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------- quote files
create table if not exists public.quote_files (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  storage_path text not null,
  original_name text not null,
  byte_size bigint not null,
  mime_type text not null,
  scan_status text not null default 'structural_ok',
  created_at timestamptz not null default now()
);

create index if not exists quote_files_quote_id_idx on public.quote_files (quote_id);

grant select on public.quote_files to authenticated;
grant all on public.quote_files to service_role;
alter table public.quote_files enable row level security;

drop policy if exists "Admins read quote files" on public.quote_files;
create policy "Admins read quote files" on public.quote_files
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));

-- ------------------------------------------------------------ proposals
do $$ begin
  create type public.proposal_status as enum (
    'draft', 'sent', 'approved', 'changes_requested', 'declined'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.proposals (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  status public.proposal_status not null default 'draft',
  model text not null,
  prompt text not null,
  content text not null,
  review_token text not null unique default encode(gen_random_bytes(24), 'hex'),
  client_response_note text,
  reviewed_by uuid,
  sent_at timestamptz,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists proposals_quote_id_idx on public.proposals (quote_id);

grant select, insert, update on public.proposals to authenticated;
grant all on public.proposals to service_role;
alter table public.proposals enable row level security;

drop policy if exists "Admins read proposals" on public.proposals;
create policy "Admins read proposals" on public.proposals
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "Admins write proposals" on public.proposals;
create policy "Admins write proposals" on public.proposals
  for update to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- ------------------------------------------------------------ audit log
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  actor_label text,
  action text not null,
  entity text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_entity_idx on public.audit_log (entity, entity_id);
create index if not exists audit_log_created_at_idx on public.audit_log (created_at desc);

grant select on public.audit_log to authenticated;
grant all on public.audit_log to service_role;
alter table public.audit_log enable row level security;

drop policy if exists "Admins read audit log" on public.audit_log;
create policy "Admins read audit log" on public.audit_log
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));

-- ------------------------------------------------------- updated_at glue
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.touch_updated_at() from public, anon, authenticated;

drop trigger if exists quotes_touch_updated_at on public.quotes;
create trigger quotes_touch_updated_at before update on public.quotes
  for each row execute function public.touch_updated_at();

drop trigger if exists proposals_touch_updated_at on public.proposals;
create trigger proposals_touch_updated_at before update on public.proposals
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------- notes
-- Storage: the private bucket `quote-uploads` already exists. No policies on
-- storage.objects are added on purpose: uploads and signed-URL downloads run
-- only through server functions using the service role.
--
-- Grant yourself admin after signing up once at /auth:
--   insert into public.user_roles (user_id, role)
--   select id, 'admin' from auth.users where email = 'you@blexware.com';
