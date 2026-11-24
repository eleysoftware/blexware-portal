alter table public.quotes
  add column if not exists secondary_emails text[] not null default '{}';

comment on column public.quotes.secondary_emails is
  'Verified collaborator addresses allowed to view this project and receive CC notifications.';

create or replace function public.viewer_can_access_quote(_quote_id uuid)
returns boolean
language sql
stable
security definer
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

drop policy if exists "Clients read own quotes" on public.quotes;
create policy "Clients read own quotes" on public.quotes
  for select to authenticated
  using (
    public.has_role(auth.uid(), 'user')
    and public.viewer_email() is not null
    and deleted_at is null
    and (
      lower(contact_email) = public.viewer_email()
      or exists (
        select 1 from unnest(secondary_emails) as collaborator(email)
        where lower(collaborator.email) = public.viewer_email()
      )
    )
  );

drop policy if exists "Clients read own quote files" on public.quote_files;
create policy "Clients read own quote files" on public.quote_files
  for select to authenticated
  using (
    public.has_role(auth.uid(), 'user')
    and public.viewer_can_access_quote(quote_id)
  );

drop policy if exists "Clients read own released proposals" on public.proposals;
create policy "Clients read own released proposals" on public.proposals
  for select to authenticated
  using (
    public.has_role(auth.uid(), 'user')
    and status <> 'draft'
    and public.viewer_can_access_quote(quote_id)
  );

drop policy if exists "Clients read own sent estimates" on public.estimates;
create policy "Clients read own sent estimates" on public.estimates
  for select to authenticated
  using (
    public.has_role(auth.uid(), 'user')
    and status <> 'draft'
    and public.viewer_can_access_quote(quote_id)
  );

drop policy if exists "Clients read own sent agreements" on public.agreements;
create policy "Clients read own sent agreements" on public.agreements
  for select to authenticated
  using (
    public.has_role(auth.uid(), 'user')
    and status <> 'draft'
    and public.viewer_can_access_quote(quote_id)
  );

drop policy if exists "Clients read own issued invoices" on public.invoices;
create policy "Clients read own issued invoices" on public.invoices
  for select to authenticated
  using (
    public.has_role(auth.uid(), 'user')
    and status <> 'scheduled'
    and public.viewer_can_access_quote(quote_id)
  );

drop policy if exists "Clients read own payments" on public.payments;
create policy "Clients read own payments" on public.payments
  for select to authenticated
  using (
    public.has_role(auth.uid(), 'user')
    and exists (
      select 1 from public.invoices i
      where i.id = payments.invoice_id
        and public.viewer_can_access_quote(i.quote_id)
    )
  );

drop policy if exists "Clients read own invoice payments" on public.invoice_payments;
create policy "Clients read own invoice payments" on public.invoice_payments
  for select to authenticated
  using (
    public.has_role(auth.uid(), 'user')
    and exists (
      select 1 from public.invoices i
      where i.id = invoice_payments.invoice_id
        and public.viewer_can_access_quote(i.quote_id)
    )
  );

drop policy if exists "Clients read own refunds" on public.refunds;
create policy "Clients read own refunds" on public.refunds
  for select to authenticated
  using (
    public.has_role(auth.uid(), 'user')
    and exists (
      select 1
      from public.invoice_payments p
      join public.invoices i on i.id = p.invoice_id
      where p.id = refunds.invoice_payment_id
        and public.viewer_can_access_quote(i.quote_id)
    )
  );

drop policy if exists "Clients read own documents" on public.documents;
create policy "Clients read own documents" on public.documents
  for select to authenticated
  using (
    public.has_role(auth.uid(), 'user')
    and public.viewer_can_access_quote(quote_id)
  );

drop policy if exists "Clients read own milestones" on public.project_milestones;
create policy "Clients read own milestones" on public.project_milestones
  for select to authenticated
  using (
    public.has_role(auth.uid(), 'user')
    and public.viewer_can_access_quote(quote_id)
  );

drop policy if exists "Clients read own resources" on public.project_resources;
create policy "Clients read own resources" on public.project_resources
  for select to authenticated
  using (
    public.has_role(auth.uid(), 'user')
    and archived_at is null
    and public.viewer_can_access_quote(quote_id)
  );