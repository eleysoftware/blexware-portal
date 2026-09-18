# Show the send date on scheduled invoices

Right now an invoice waiting to go out just shows as "scheduled" (or "Upcoming" for clients) with no indication of when it will be sent. This adds the send date everywhere that invoice appears.

## What changes

- Any invoice with the status "scheduled" shows "sends Mar 4, 2026" next to its number, alongside the existing issued/due dates.
- Applies in all four places invoices are listed:
  - Admin project queue on the admin home page
  - Admin project view, Invoices tab
  - Client portal home (project cards with their invoices)
  - Client project view, Invoices tab — worded for clients, e.g. "arrives Mar 4, 2026"
- If a scheduled invoice has no send date recorded, nothing extra is shown (no "Invalid Date").
- Paused schedules keep their existing treatment; the date shown is the planned send date on the record.

## Technical notes

- The date already exists as `invoices.scheduled_send_at`; no database change is needed.
- `getEngagement` selects `*`, so the admin and client project panels already receive it — only the display needs updating:
  - `src/components/admin/AdminEngagementPanel.tsx` (invoice row, near the due-date text) — widen the local invoice type with `scheduled_send_at`.
  - `src/components/EngagementPanel.tsx` (`PortalInvoice` type + row text, and the installment summary already showing "sends …").
- The two queue fetchers select explicit columns and must add `scheduled_send_at`, then pass it through as `scheduledSendAt`:
  - `src/lib/admin.functions.ts` (invoice list for the admin queue) → rendered in `src/routes/_authenticated/admin/index.tsx`.
  - `src/lib/portal.functions.ts` (`PortalInvoiceRow`) → rendered in `src/routes/_authenticated/portal/index.tsx`.
- Formatting uses the same `new Date(value).toLocaleDateString()` pattern already in those rows, guarded for null/invalid values.
