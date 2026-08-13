-- BLEXware — client ("user") role access
--
-- Clients see ONLY rows whose contact_email matches their own verified account
-- email. Matching is case-insensitive and requires a confirmed address, so an
-- unverified sign-up can never read another customer's quote.
--
-- Writes remain service-role only; nothing here grants INSERT/UPDATE/DELETE.

-- Verified email of the current requester, or null.
create or replace function public.viewer_email()
returns text
language sql
stable
set search_path = public
as $$
  select case
    when coalesce((auth.jwt() -> 'user_metadata' ->> 'email_verified')::boolean, false)
      then lower(auth.jwt() ->> 'email')
    else null
  end
$$;

revoke all on function public.viewer_email() from public, anon;
grant execute on function public.viewer_email() to authenticated, service_role;

-- Quotes ---------------------------------------------------------------------
drop policy if exists "Clients read own quotes" on public.quotes;
create policy "Clients read own quotes" on public.quotes
  for select to authenticated
  using (
    public.has_role(auth.uid(), 'user')
    and public.viewer_email() is not null
    and lower(contact_email) = public.viewer_email()
    and deleted_at is null
  );

-- Quote files ----------------------------------------------------------------
drop policy if exists "Clients read own quote files" on public.quote_files;
create policy "Clients read own quote files" on public.quote_files
  for select to authenticated
  using (
    public.has_role(auth.uid(), 'user')
    and exists (
      select 1 from public.quotes q
      where q.id = quote_files.quote_id
        and q.deleted_at is null
        and public.viewer_email() is not null
        and lower(q.contact_email) = public.viewer_email()
    )
  );

-- Proposals ------------------------------------------------------------------
-- Drafts stay internal; only released proposals are visible to the client.
drop policy if exists "Clients read own released proposals" on public.proposals;
create policy "Clients read own released proposals" on public.proposals
  for select to authenticated
  using (
    public.has_role(auth.uid(), 'user')
    and status <> 'draft'
    and exists (
      select 1 from public.quotes q
      where q.id = proposals.quote_id
        and q.deleted_at is null
        and public.viewer_email() is not null
        and lower(q.contact_email) = public.viewer_email()
    )
  );

-- Note: public.quotes.internal_notes and source_ip are never selected by the
-- portal server functions. Column-level exposure is limited in application
-- code; do not add a client-facing view that projects those columns.
