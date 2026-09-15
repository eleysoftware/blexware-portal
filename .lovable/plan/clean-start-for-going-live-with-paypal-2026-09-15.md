# Clean start for going live with PayPal

Everything you have today (quotes, projects, invoices, payments, documents) becomes
**test data**: still there, still openable, but hidden from the normal views so the
team queue and the client portal start empty for real business.

## What you'll see

1. **A test flag on every project.** Each project gets a "test data" marker. Everything
   under it — proposals, estimates, SOWs, invoices, payments, milestones, files — is
   treated as test along with it, because it all hangs off the project.

2. **One-time switch-over.** Every project that exists right now is marked as test.
   Anything created after that is real by default.

3. **Hidden by default.** The team queue shows only real projects. A "Show test data"
   switch at the top reveals the old records (clearly badged "TEST"), so nothing is lost
   and you can still look up an old bill. Any project can be flipped between test and
   real from its row, with a confirmation.

4. **Client portal never shows test data.** A client signing in sees only real projects,
   whatever their history.

5. **Clearing test client accounts.** A "Clean up test clients" action in the admin area
   lists sign-in accounts whose only projects are test projects, excludes anyone with an
   admin or staff role, and shows you the list with emails before you confirm. Confirming
   removes those accounts. Nothing is removed without you seeing the list first.

6. **Going live stays yours.** No change to the payment provider card — you flip PayPal
   to Live yourself when you're ready. Old test payment records keep their existing
   sandbox marking, so live payments will be plainly distinguishable.

## Safety

- Nothing is deleted in the data cleanup — old records are marked, not removed. Only the
  client-account cleanup removes anything, and only after you confirm a named list.
- Admin and staff accounts are never touched.
- Both the test marking and the account cleanup are written to the activity log.

## Technical notes

- Migration: `is_test boolean not null default false` on `public.quotes`, plus an index;
  a one-time `UPDATE public.quotes SET is_test = true` for all existing rows in the same
  migration. Mirrored as `supabase/schema/013_test_data_flag.sql`. No other table changes
  — test scope is derived through `quote_id`.
- Reads filtered on `is_test`: `listQuotes` in `src/lib/admin.functions.ts` (new optional
  `includeTest` input, default false), and the portal listings in
  `src/lib/portal.functions.ts` (always `eq("is_test", false)`). Token routes
  (`/invoice/$token`, `/proposal/$token`) are unchanged so existing links still resolve.
- New admin-only server fns in `src/lib/admin.functions.ts`: `setQuoteTestFlag`
  ({ quoteId, isTest }) with an `quote.test_flag_changed` audit, and
  `listTestOnlyClients` / `deleteTestClients` — the list groups `quotes.contact_email`,
  keeps only emails with zero non-test projects, resolves them against
  `supabaseAdmin.auth.admin.listUsers()`, drops any user id present in `user_roles`, and
  deletes via `auth.admin.deleteUser` with a `client.test_account_deleted` audit each.
- UI: "Show test data" switch + TEST badge and a per-row test/real toggle in
  `src/routes/_authenticated/admin/index.tsx`; a "Clean up test clients" dialog
  (list + typed confirmation) as a new component under `src/components/admin/`.
- Tests: filter defaults (test rows excluded from admin and portal lists), the
  test-only-client selection excluding role-holders and mixed-history emails.
- Note: this migration and the two outstanding ones (`011`, `012`) need to be applied
  before the clean start is complete.
