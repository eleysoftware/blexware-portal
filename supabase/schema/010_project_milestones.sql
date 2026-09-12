-- BLEXware — project milestones (Kanban board)
--
-- Phases from the proposal become milestones the team moves through lanes.
-- Staff/admin manage them through the service role; clients get read-only
-- access to milestones on projects that match their verified email.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'milestone_lane') then
    create type public.milestone_lane as enum ('not_started', 'in_progress', 'testing', 'done');
  end if;
end $$;

create table if not exists public.project_milestones (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  title text not null,
  note text,
  target_duration text,
  lane public.milestone_lane not null default 'not_started',
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists project_milestones_quote_idx
  on public.project_milestones (quote_id, lane, position);

grant select on public.project_milestones to authenticated;
grant all on public.project_milestones to service_role;

alter table public.project_milestones enable row level security;

drop policy if exists "Staff read milestones" on public.project_milestones;
create policy "Staff read milestones" on public.project_milestones
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'staff'));

drop policy if exists "Clients read own milestones" on public.project_milestones;
create policy "Clients read own milestones" on public.project_milestones
  for select to authenticated
  using (
    public.has_role(auth.uid(), 'user')
    and exists (
      select 1 from public.quotes q
      where q.id = project_milestones.quote_id
        and q.deleted_at is null
        and public.viewer_email() is not null
        and lower(q.contact_email) = public.viewer_email()
    )
  );

drop trigger if exists project_milestones_touch_updated_at on public.project_milestones;
create trigger project_milestones_touch_updated_at
  before update on public.project_milestones
  for each row execute function public.touch_updated_at();
