-- 016_storage_policy_cleanup.sql
-- Security fix: remove the "negative" storage.objects policies.
--
-- Policies written as `bucket_id <> '<bucket>'` are PERMISSIVE grants: they
-- deny the named bucket but simultaneously grant anon/authenticated access to
-- every OTHER object in storage, with no owner binding. Storage RLS is
-- deny-by-default, so no policy at all is the correct way to express
-- "browsers can never touch this bucket" — server code uses the service role,
-- which bypasses RLS.
--
-- NOTE: do NOT run `alter table storage.objects enable row level security;`
-- here — that table is owned by supabase_storage_admin and RLS is already on.

-- documents bucket
drop policy if exists "documents bucket is service-role only" on storage.objects;
drop policy if exists "documents no client insert" on storage.objects;
drop policy if exists "documents no client update" on storage.objects;
drop policy if exists "documents no client delete" on storage.objects;

-- quote-uploads bucket
drop policy if exists "quote uploads no client insert" on storage.objects;

-- project-resources bucket
drop policy if exists "project resources no client insert" on storage.objects;
drop policy if exists "project resources no client update" on storage.objects;
drop policy if exists "project resources no client delete" on storage.objects;

-- Remaining storage policies stay in place and are all scoped to one bucket
-- plus an admin role check:
--   "documents admin read", "quote uploads admin read/update/delete".
