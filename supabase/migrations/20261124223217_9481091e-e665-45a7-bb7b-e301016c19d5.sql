create or replace function public.viewer_can_access_quote(_quote_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1
    from public.quotes q
    where q.id = _quote_id
      and q.deleted_at is null
      and public.viewer_email() is not null
      and (
        lower(q.contact_email) = public.viewer_email()
        or exists (
          select 1
          from unnest(q.secondary_emails) as collaborator(email)
          where lower(collaborator.email) = public.viewer_email()
        )
      )
  )
$$;

revoke all on function public.viewer_can_access_quote(uuid) from public, anon;
grant execute on function public.viewer_can_access_quote(uuid) to authenticated, service_role;