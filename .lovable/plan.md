# Surface payment method toggles + remove the seed button

## 1. Where the toggles are today

The "Payment methods" card was added inside the **Invoices tab of a single quote workspace** (`/admin/quotes/<id>` → Invoices). That tab only appears when a quote has reached the invoicing stage, so from the quote queue it looks like the toggles don't exist. The setting itself is global, not per quote, so that placement is wrong.

## 2. Move it to the admin dashboard

Add a **Settings** card to the main admin page (`/admin`), visible to admins right under the quote queue header area:

- Card title "Payment methods", with the same two switches — "Credit or debit card" and "Bank transfer (ACH)" — and a note that ACH must also be enabled with the payment provider.
- Saves immediately, toasts on success, writes to the audit log (already implemented server-side).
- Remove the duplicate card from the quote workspace's Invoices tab, and instead show a one-line read-only note there ("Clients can currently pay by card. Change this in Admin → Settings.") so the context is still visible where invoices are managed.

## 3. Remove "Load Build Financial Wellness" entirely

You're right — there's nothing to keep. Nothing in the test suite or any tooling calls it: the only references are the admin button, the `seedWellnessProject` server function, and the hardcoded Build Financial Wellness content it seeds. "Import existing project" fully replaces it. So the whole path gets deleted:

- the button on the admin dashboard,
- the `seedWellnessProject` server function,
- `src/lib/seed-wellness.server.ts`,
- `src/content/build-financial-wellness.ts` (its hardcoded proposal/estimate data has no other consumer).

Tamara West's existing project data already lives in the database, so removing the seeder doesn't affect it.


## Technical notes

- `src/routes/_authenticated/admin/index.tsx`: remove the `seedWellnessProject` button, its `seeding` state and import; add the settings card.
- New `src/components/admin/PaymentMethodSettingsCard.tsx` holding the query/mutation currently inline in `AdminEngagementPanel.tsx` (`getPaymentMethodSettingsFn` / `setPaymentMethodEnabledFn`).
- `src/components/admin/AdminEngagementPanel.tsx`: delete the toggles block (lines ~1100-1131) plus the now-unused query/mutation, replace with the read-only note.
- Delete `src/lib/seed-wellness.server.ts`, `src/content/build-financial-wellness.ts`, and `seedWellnessProject` in `src/lib/engagement.functions.ts` (verified: no test or other module imports them).
- No database or server-function schema changes; `007_app_settings.sql` is already applied.

