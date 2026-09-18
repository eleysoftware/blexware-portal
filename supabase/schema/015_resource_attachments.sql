-- BLEXware — multiple attachments per resource (Resources tab)
--
-- Safe to run whether or not 014_project_resources.sql has been applied:
-- it creates the base table if missing, adds the `attachments` jsonb column,
-- backfills legacy single-file rows, and (re)applies the same grants, RLS
-- policies and storage policies as 014.
--
-- Each entry in `attachments`: {"path": "...", "name": "...", "mime": "...", "size": 123}

create table if not exists public.project_resources (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  title text not null,
  description text,
  attachments jsonb not null default '[]'::jsonb,
  storage_path text,
  original_name text,
  mime_type text,
  byte_size bigint,
  author_id uuid,
  author_email text,
  author_label text,
  author_role text not null default 'staff',
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 014 already applied? The table exists without `attachments`.
alter table public.project_resources
  add column if not exists attachments jsonb not null default '[]'::jsonb;

-- One-time backfill: rows carrying the legacy single file become one-entry lists.
update public.project_resources
set attachments = jsonb_build_array(
      jsonb_build_object(
        'path', storage_path,
        'name', coalesce(original_name, 'file'),
        'mime', coalesce(mime_type, 'application/octet-stream'),
        'size', coalesce(byte_size, 0)
      )
    )
where storage_path is not null
  and jsonb_array_length(attachments) = 0;

create index if not exists project_resources_quote_idx
  on public.project_resources (quote_id, created_at desc);

grant select on public.project_resources to authenticated;
grant all on public.project_resources to service_role;

alter table public.project_resources enable row level security;

drop policy if exists "Staff read resources" on public.project_resources;
create policy "Staff read resources" on public.project_resources
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'staff'));

drop policy if exists "Clients read own resources" on public.project_resources;
create policy "Clients read own resources" on public.project_resources
  for select to authenticated
  using (
    archived_at is null
    and exists (
      select 1 from public.quotes q
      where q.id = project_resources.quote_id
        and q.deleted_at is null
        and public.viewer_email() is not null
        and lower(q.contact_email) = public.viewer_email()
    )
  );

drop trigger if exists project_resources_touch_updated_at on public.project_resources;
create trigger project_resources_touch_updated_at
  before update on public.project_resources
  for each row execute function public.touch_updated_at();

-- Private bucket `project-resources` already exists (50 MB per file).
-- Browser writes stay impossible on purpose.
drop policy if exists "project resources no client insert" on storage.objects;
create policy "project resources no client insert"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id <> 'project-resources');

drop policy if exists "project resources no client update" on storage.objects;
create policy "project resources no client update"
  on storage.objects for update
  to anon, authenticated
  using (bucket_id <> 'project-resources')
  with check (bucket_id <> 'project-resources');

drop policy if exists "project resources no client delete" on storage.objects;
create policy "project resources no client delete"
  on storage.objects for delete
  to anon, authenticated
  using (bucket_id <> 'project-resources');
