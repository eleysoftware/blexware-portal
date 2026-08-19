-- 006_storage_policies.sql
-- Run this in the Supabase SQL editor for project ptvwcblnkumrhiohavvv.
-- Adds explicit, scoped storage.objects policies for the private "documents"
-- bucket and makes the intentional no-browser-upload rule for "quote-uploads"
-- explicit instead of implicit.
--
-- NOTE: do NOT run `alter table storage.objects enable row level security;`
-- here — that table is owned by supabase_storage_admin and RLS is already on.

-- ---------------------------------------------------------------------------
-- 1. "documents" bucket (rendered proposals, SOW agreements, invoices)
--    Writes happen server-side with the service role (bypasses RLS).
--    Admins may read objects; clients receive short-lived signed URLs minted
--    server-side after their access is verified, so they need no direct policy.
-- ---------------------------------------------------------------------------
drop policy if exists "documents bucket is service-role only" on storage.objects;

drop policy if exists "documents admin read" on storage.objects;
create policy "documents admin read"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'documents' and public.has_role(auth.uid(), 'admin'));

drop policy if exists "documents no client insert" on storage.objects;
create policy "documents no client insert"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id <> 'documents');

drop policy if exists "documents no client update" on storage.objects;
create policy "documents no client update"
  on storage.objects for update
  to anon, authenticated
  using (bucket_id <> 'documents')
  with check (bucket_id <> 'documents');

drop policy if exists "documents no client delete" on storage.objects;
create policy "documents no client delete"
  on storage.objects for delete
  to anon, authenticated
  using (bucket_id <> 'documents');

-- ---------------------------------------------------------------------------
-- 2. "quote-uploads" bucket
--    Browser uploads are intentionally impossible: the quote wizard posts files
--    to a server function that validates size/type/structure and stores them
--    with the service role. Make that deny explicit rather than implicit.
-- ---------------------------------------------------------------------------
drop policy if exists "quote uploads no client insert" on storage.objects;
create policy "quote uploads no client insert"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id <> 'quote-uploads');
