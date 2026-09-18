-- BLEXware — project resources (Resources tab)
--
-- Notes and optional attachments shared between the team and the client on a
-- project. Writes run through the service role in server functions; reads are
-- RLS-gated (staff see everything, clients see their own, unarchived).

create table if not exists public.project_resources (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  title text not null,
  description text,
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

-- Private bucket `project-resources` already exists (created through the
-- storage tool, 50 MB per file). Browser writes stay impossible on purpose.
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
