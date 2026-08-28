# Surface payment method toggles + remove the seed button

## 1. Where the toggles are today

The "Payment methods" card was added inside the **Invoices tab of a single quote workspace** (`/admin/quotes/<id>` → Invoices). That tab only appears when a quote has reached the invoicing stage, so from the quote queue it looks like the toggles don't exist. The setting itself is global, not per quote, so that placement is wrong.

## 2. Move it to the admin dashboard

Add a **Settings** card to the main admin page (`/admin`), visible to admins right under the quote queue header area:

- Card title "Payment methods", with the same two switches — "Credit or debit card" and "Bank transfer (ACH)" — and a note that ACH must also be enabled with the payment provider.
- Saves immediately, toasts on success, writes to the audit log (already implemented server-side).
- Remove the duplicate card from the quote workspace's Invoices tab, and instead show a one-line read-only note there ("Clients can currently pay by card. Change this in Admin → Settings.") so the context is still visible where invoices are managed.

## 3. Replace the seeder with a prefill on the import page

The two things are different: the old button was a *seeder* — it wrote rows straight into the database with no review. "Import existing project" is a *form* you fill in and submit. So there is nothing to seed, but you do still need her content on hand, and today it only exists inside the seeder's code.

So instead of deleting that content outright:

- Delete the seeder path: the dashboard button, the `seedWellnessProject` server function, and `src/lib/seed-wellness.server.ts` (nothing else calls them, and no test references them).
- Keep the Build Financial Wellness content and reuse it as a **prefill template** on the import page: a "Prefill: Build Financial Wellness" button at the top of the form fills in the client details, proposal markdown, stage, line items and duration. You review/edit and press "Import project" as normal.
- The template list is a simple array, so more prefills can be added later.

That way you can still recreate Tamara West's project in a couple of clicks, but it goes through the same reviewed import path as everything else.

## 4. Find Tamara West's project first

I can't read the database directly right now (the query tool is blocked), so this is unverified: the quote may be missing, or it may exist but be filtered out of the queue. The admin queue only lists quotes where `deleted_at` is empty, and it also filters by the selected status chip — so a soft-deleted or off-filter quote is invisible with no way to tell.

Step one of the build is to look up the quote by contact email and report back which case it is:

- **It exists and is visible** — nothing to do; it was a filter/search issue.
- **It exists but is soft-deleted** — the new archive view (below) will surface it and let you restore it.
- **It doesn't exist** — recreate it with the import prefill from step 3.


## 5. Archive / delete for quotes

The `quotes` table already has a `deleted_at` column that nothing in the UI uses. Wire it up as archiving:

- Each row in the admin quote queue gets an actions menu with **Archive** (sets `deleted_at`, with a confirm dialog) and, for already-archived rows, **Restore**.
- A new "Archived" chip alongside the status filters shows archived quotes only; the default views continue to exclude them.
- The quote workspace page (`/admin/quotes/<id>`) gets the same Archive/Restore action in its header, plus an "Archived" badge when applicable.
- Archiving is admin-only, reversible, and written to the audit log. Archived quotes stay out of client-facing pages.
- **Permanent delete** is offered only from the Archived view, behind a type-the-quote-number confirmation, and is blocked when the quote has a signed agreement or any sent/paid invoice (those must be kept for records) — in that case the UI explains why and offers archive instead.

## Technical notes

- `src/routes/_authenticated/admin/index.tsx`: remove the `seedWellnessProject` button, its `seeding` state and import; add the settings card, the "Archived" filter chip, and the per-row actions menu.
- New `src/components/admin/PaymentMethodSettingsCard.tsx` holding the query/mutation currently inline in `AdminEngagementPanel.tsx` (`getPaymentMethodSettingsFn` / `setPaymentMethodEnabledFn`).
- `src/components/admin/AdminEngagementPanel.tsx`: delete the toggles block (lines ~1100-1131) plus the now-unused query/mutation, replace with the read-only note.
- Delete `src/lib/seed-wellness.server.ts`, `src/content/build-financial-wellness.ts`, and `seedWellnessProject` in `src/lib/engagement.functions.ts` (verified: no test or other module imports them).
- `src/lib/admin.functions.ts`: `listQuotes` gains an `archived` mode (`deleted_at` not null) instead of always filtering `is deleted_at null`; new admin-gated `archiveQuote`, `restoreQuote`, and `deleteQuotePermanently` server functions, all writing to the audit log, with the delete guarded by the signed-agreement / issued-invoice check and cascading cleanup of that quote's stored files and documents.
- No schema migration needed — `quotes.deleted_at` already exists; `007_app_settings.sql` is already applied.


