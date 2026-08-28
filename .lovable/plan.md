# Surface payment method toggles + remove the seed button

## 1. Where the toggles are today

The "Payment methods" card was added inside the **Invoices tab of a single quote workspace** (`/admin/quotes/<id>` → Invoices). That tab only appears when a quote has reached the invoicing stage, so from the quote queue it looks like the toggles don't exist. The setting itself is global, not per quote, so that placement is wrong.

## 2. Move it to the admin dashboard

Add a **Settings** card to the main admin page (`/admin`), visible to admins right under the quote queue header area:

- Card title "Payment methods", with the same two switches — "Credit or debit card" and "Bank transfer (ACH)" — and a note that ACH must also be enabled with the payment provider.
- Saves immediately, toasts on success, writes to the audit log (already implemented server-side).
- Remove the duplicate card from the quote workspace's Invoices tab, and instead show a one-line read-only note there ("Clients can currently pay by card. Change this in Admin → Settings.") so the context is still visible where invoices are managed.

## 3. Remove "Load Build Financial Wellness"

Drop that button from the admin dashboard header; importing a project is now handled by "Import existing project". The underlying seed server function stays in place (it is still referenced by tests/seed tooling) but is no longer reachable from the UI.

## Technical notes

- `src/routes/_authenticated/admin/index.tsx`: remove the `seedWellnessProject` button and its `seeding` state/import; add a small `PaymentMethodSettingsCard` render.
- New `src/components/admin/PaymentMethodSettingsCard.tsx` holding the query/mutation currently inline in `AdminEngagementPanel.tsx` (`getPaymentMethodSettingsFn` / `setPaymentMethodEnabledFn`).
- `src/components/admin/AdminEngagementPanel.tsx`: delete the toggles block (lines ~1100-1131) plus the now-unused query/mutation, replace with the read-only note.
- No database or server-function changes; `007_app_settings.sql` is already applied.
