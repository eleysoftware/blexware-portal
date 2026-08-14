-- BLEXware engagement pipeline: proposal versions, estimates, SOW agreements,
-- invoices and payments. Run once in the Supabase SQL editor.

-- ------------------------------------------------------------ quote status
alter type public.quote_status add value if not exists 'estimate_draft';
alter type public.quote_status add value if not exists 'estimate_sent';
alter type public.quote_status add value if not exists 'estimate_approved';
alter type public.quote_status add value if not exists 'contract_sent';
alter type public.quote_status add value if not exists 'signed';
alter type public.quote_status add value if not exists 'invoicing';
alter type public.quote_status add value if not exists 'completed';

commit;

-- ------------------------------------------------------------ enums
do $$ begin
  create type public.estimate_status as enum ('draft','sent','approved','declined','expired');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.agreement_status as enum ('draft','sent','signed','void');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.invoice_status as enum ('scheduled','sent','paid','void');
exception when duplicate_object then null; end $$;

-- ------------------------------------------------- proposals: doc + expiry
alter table public.proposals add column if not exists doc jsonb;
alter table public.proposals add column if not exists version integer not null default 1;
alter table public.proposals add column if not exists expires_at timestamptz;
alter table public.proposals add column if not exists reminder_sent_at timestamptz;

create table if not exists public.proposal_versions (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  version integer not null,
  content text not null,
  doc jsonb,
  change_request text,
  created_at timestamptz not null default now()
);
grant select on public.proposal_versions to authenticated;
grant all on public.proposal_versions to service_role;
alter table public.proposal_versions enable row level security;

drop policy if exists "Admins read proposal versions" on public.proposal_versions;
create policy "Admins read proposal versions" on public.proposal_versions
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));

-- ------------------------------------------------------------- estimates
create table if not exists public.estimates (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  proposal_id uuid references public.proposals(id) on delete set null,
  status public.estimate_status not null default 'draft',
  doc jsonb not null default '{}'::jsonb,
  line_items jsonb not null default '[]'::jsonb,
  subtotal_cents bigint not null default 0,
  discount_cents bigint not null default 0,
  total_cents bigint not null default 0,
  duration_note text,
  review_token text not null default encode(extensions.gen_random_bytes(24), 'hex'),
  sent_at timestamptz,
  expires_at timestamptz,
  responded_at timestamptz,
  response_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.estimates to authenticated;
grant all on public.estimates to service_role;
alter table public.estimates enable row level security;

drop trigger if exists estimates_touch_updated_at on public.estimates;
create trigger estimates_touch_updated_at before update on public.estimates
  for each row execute function public.touch_updated_at();

drop policy if exists "Admins read estimates" on public.estimates;
create policy "Admins read estimates" on public.estimates
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "Clients read own sent estimates" on public.estimates;
create policy "Clients read own sent estimates" on public.estimates
  for select to authenticated using (
    status <> 'draft' and exists (
      select 1 from public.quotes q
      where q.id = estimates.quote_id
        and q.deleted_at is null
        and public.viewer_email() is not null
        and lower(q.contact_email) = public.viewer_email()
    )
  );

drop policy if exists "No client writes on estimates" on public.estimates;
create policy "No client writes on estimates" on public.estimates
  for insert to anon, authenticated with check (false);

-- ------------------------------------------------------------ agreements
create sequence if not exists public.agreement_number_seq;

create or replace function public.next_agreement_number()
returns text language sql volatile security definer set search_path = public as $$
  select 'SOW-' || to_char(now(), 'YYYY') || '-' ||
         lpad(nextval('public.agreement_number_seq')::text, 4, '0')
$$;
revoke all on function public.next_agreement_number() from public, anon, authenticated;
grant execute on function public.next_agreement_number() to service_role;

create table if not exists public.agreements (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  estimate_id uuid references public.estimates(id) on delete set null,
  agreement_number text not null unique default public.next_agreement_number(),
  status public.agreement_status not null default 'draft',
  doc jsonb not null default '{}'::jsonb,
  total_cents bigint not null default 0,
  review_token text not null default encode(extensions.gen_random_bytes(24), 'hex'),
  sent_at timestamptz,
  signed_at timestamptz,
  signer_name text,
  signer_email text,
  signer_ip text,
  signer_user_agent text,
  document_hash text,
  signed_pdf_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.agreements to authenticated;
grant all on public.agreements to service_role;
alter table public.agreements enable row level security;

drop trigger if exists agreements_touch_updated_at on public.agreements;
create trigger agreements_touch_updated_at before update on public.agreements
  for each row execute function public.touch_updated_at();

drop policy if exists "Admins read agreements" on public.agreements;
create policy "Admins read agreements" on public.agreements
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "Clients read own sent agreements" on public.agreements;
create policy "Clients read own sent agreements" on public.agreements
  for select to authenticated using (
    status <> 'draft' and exists (
      select 1 from public.quotes q
      where q.id = agreements.quote_id
        and q.deleted_at is null
        and public.viewer_email() is not null
        and lower(q.contact_email) = public.viewer_email()
    )
  );

drop policy if exists "No client writes on agreements" on public.agreements;
create policy "No client writes on agreements" on public.agreements
  for insert to anon, authenticated with check (false);

-- -------------------------------------------------------------- invoices
create sequence if not exists public.invoice_number_seq;

create or replace function public.next_invoice_number()
returns text language sql volatile security definer set search_path = public as $$
  select 'INV-' || to_char(now(), 'YYYY') || '-' ||
         lpad(nextval('public.invoice_number_seq')::text, 4, '0')
$$;
revoke all on function public.next_invoice_number() from public, anon, authenticated;
grant execute on function public.next_invoice_number() to service_role;

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  agreement_id uuid not null references public.agreements(id) on delete cascade,
  invoice_number text not null unique default public.next_invoice_number(),
  sequence integer not null,
  amount_cents bigint not null,
  status public.invoice_status not null default 'scheduled',
  due_date date,
  scheduled_send_at timestamptz,
  paused boolean not null default false,
  sent_at timestamptz,
  paid_at timestamptz,
  stripe_session_id text,
  stripe_payment_intent text,
  pay_token text not null default encode(extensions.gen_random_bytes(24), 'hex'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.invoices to authenticated;
grant all on public.invoices to service_role;
alter table public.invoices enable row level security;

drop trigger if exists invoices_touch_updated_at on public.invoices;
create trigger invoices_touch_updated_at before update on public.invoices
  for each row execute function public.touch_updated_at();

drop policy if exists "Admins read invoices" on public.invoices;
create policy "Admins read invoices" on public.invoices
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "Clients read own issued invoices" on public.invoices;
create policy "Clients read own issued invoices" on public.invoices
  for select to authenticated using (
    status <> 'scheduled' and exists (
      select 1 from public.quotes q
      where q.id = invoices.quote_id
        and q.deleted_at is null
        and public.viewer_email() is not null
        and lower(q.contact_email) = public.viewer_email()
    )
  );

drop policy if exists "No client writes on invoices" on public.invoices;
create policy "No client writes on invoices" on public.invoices
  for insert to anon, authenticated with check (false);

-- -------------------------------------------------------------- payments
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  amount_cents bigint not null,
  provider text not null default 'stripe',
  provider_ref text,
  status text not null default 'succeeded',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create unique index if not exists payments_provider_ref_key
  on public.payments (provider, provider_ref) where provider_ref is not null;

grant select on public.payments to authenticated;
grant all on public.payments to service_role;
alter table public.payments enable row level security;

drop policy if exists "Admins read payments" on public.payments;
create policy "Admins read payments" on public.payments
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "Clients read own payments" on public.payments;
create policy "Clients read own payments" on public.payments
  for select to authenticated using (
    exists (
      select 1 from public.invoices i join public.quotes q on q.id = i.quote_id
      where i.id = payments.invoice_id
        and q.deleted_at is null
        and public.viewer_email() is not null
        and lower(q.contact_email) = public.viewer_email()
    )
  );

drop policy if exists "No client writes on payments" on public.payments;
create policy "No client writes on payments" on public.payments
  for insert to anon, authenticated with check (false);

-- ------------------------------------------------------- generated docs
-- Rendered PDF/DOCX files live in the private "documents" bucket. Only the
-- service role touches storage; clients receive short-lived signed URLs.
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  entity text not null,
  entity_id uuid not null,
  kind text not null,
  format text not null,
  storage_path text not null,
  byte_size bigint not null default 0,
  sha256 text,
  created_at timestamptz not null default now()
);
grant select on public.documents to authenticated;
grant all on public.documents to service_role;
alter table public.documents enable row level security;

drop policy if exists "Admins read documents" on public.documents;
create policy "Admins read documents" on public.documents
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "Clients read own documents" on public.documents;
create policy "Clients read own documents" on public.documents
  for select to authenticated using (
    exists (
      select 1 from public.quotes q
      where q.id = documents.quote_id
        and q.deleted_at is null
        and public.viewer_email() is not null
        and lower(q.contact_email) = public.viewer_email()
    )
  );

drop policy if exists "No client writes on documents" on public.documents;
create policy "No client writes on documents" on public.documents
  for insert to anon, authenticated with check (false);

-- Deny-by-default for the documents storage bucket (service role bypasses RLS).
drop policy if exists "documents bucket is service-role only" on storage.objects;
create policy "documents bucket is service-role only" on storage.objects
  for select to anon, authenticated using (false);
