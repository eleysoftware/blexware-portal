-- 002_security_hardening.sql
-- Run this in the Supabase SQL editor for project ptvwcblnkumrhiohavvv.
-- Addresses: storage policies for quote-uploads, explicit write policies for the
-- quote pipeline tables, and SECURITY DEFINER execute grants.

-- ---------------------------------------------------------------------------
-- 1. SECURITY DEFINER function execute grants
--    All writes happen server-side with the service role. Only has_role() must
--    stay callable by authenticated users, because RLS policies evaluate it.
-- ---------------------------------------------------------------------------
revoke all on function public.rls_auto_enable() from public, anon, authenticated;

revoke all on function public.next_quote_number() from public, anon, authenticated;
grant execute on function public.next_quote_number() to service_role;

revoke all on function public.touch_updated_at() from public, anon, authenticated;
grant execute on function public.touch_updated_at() to service_role;

revoke all on function public.has_role(uuid, public.app_role) from public, anon;
grant execute on function public.has_role(uuid, public.app_role) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Storage policies for the private quote-uploads bucket
--    Uploads are performed server-side with the service role (bypasses RLS).
--    Clients get NO direct write access; admins may read/manage objects.
-- ---------------------------------------------------------------------------
alter table storage.objects enable row level security;

drop policy if exists "quote uploads admin read" on storage.objects;
create policy "quote uploads admin read"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'quote-uploads' and public.has_role(auth.uid(), 'admin'));

drop policy if exists "quote uploads admin update" on storage.objects;
create policy "quote uploads admin update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'quote-uploads' and public.has_role(auth.uid(), 'admin'))
  with check (bucket_id = 'quote-uploads' and public.has_role(auth.uid(), 'admin'));

drop policy if exists "quote uploads admin delete" on storage.objects;
create policy "quote uploads admin delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'quote-uploads' and public.has_role(auth.uid(), 'admin'));

-- No INSERT policy for anon/authenticated on quote-uploads: browser uploads are
-- intentionally impossible. The quote wizard posts files to a server function
-- which validates size/type and stores them with the service role.

-- ---------------------------------------------------------------------------
-- 3. Explicit deny-by-default writes for the quote pipeline
--    Documented as explicit false policies so the intent is unambiguous.
-- ---------------------------------------------------------------------------
drop policy if exists "No client inserts on quotes" on public.quotes;
create policy "No client inserts on quotes"
  on public.quotes for insert
  to anon, authenticated
  with check (false);

drop policy if exists "No client inserts on quote files" on public.quote_files;
create policy "No client inserts on quote files"
  on public.quote_files for insert
  to anon, authenticated
  with check (false);

drop policy if exists "No client inserts on proposals" on public.proposals;
create policy "No client inserts on proposals"
  on public.proposals for insert
  to anon, authenticated
  with check (false);

-- ---------------------------------------------------------------------------
-- 4. Auth hardening (dashboard setting, cannot be set in SQL)
--    Authentication -> Providers -> Email -> enable "Leaked password protection"
-- ---------------------------------------------------------------------------
