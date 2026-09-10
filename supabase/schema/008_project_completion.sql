-- Project completion sign-off. A project stays in `invoicing` after the final
-- payment; it only becomes `completed` once the work is signed off. The admin
-- requests completion, the client confirms (or asks for changes).
alter table public.quotes add column if not exists completion_requested_at timestamptz;
alter table public.quotes add column if not exists completion_note text;
alter table public.quotes add column if not exists completed_at timestamptz;
-- 'client' when the client confirmed, 'admin' when BLEXware closed it out.
alter table public.quotes add column if not exists completion_confirmed_by text;
alter table public.quotes add column if not exists completion_change_request text;
