# Invoice emails not reaching the client

## What the code shows

Two separate things can leave a client with no email after invoices are created:

1. **Only the first bill is ever emailed.** When a direct invoice is split into several payments, the first one is emailed if "send now" is chosen; the rest are saved as **drafts**. The nightly job that mails out upcoming payments only picks up invoices marked *scheduled*, so drafts sit there forever and no email goes out until someone presses "Send now" on each one.

2. **A failed send still shows as "Sent".** When the mail provider refuses the message (unverified sender, bad key, blocked recipient), the invoice is still flipped to "Sent" and no one is told. The only trace is in the server logs. So a bill can look delivered in the team queue while nothing arrived.

Which of the two happened here is not yet confirmed — reading the live records is currently switched off. The first step below confirms it before anything else changes.

## Plan

### 1. Confirm what happened to this client's invoices
Check the invoices for the affected project: their status (draft vs sent), whether a send was attempted, and what the provider said. If the send was attempted and refused, the fix is the sender/provider setting, not code. Report the finding before making changes.

### 2. Make delivery honest
- If the provider refuses the message, keep the invoice out of "Sent", record the reason on the invoice, and show it in the team queue as "Not delivered — <reason>" with a Retry button.
- Show the same warning on the create-invoice confirmation instead of a plain success message.

### 3. Stop split payments from going silent
- Later payments in a split are created as **scheduled** with their send date, so the nightly job mails them when due (today's behaviour for signed-SOW schedules).
- On the new invoice form, state plainly what will happen: "Payment 1 is emailed now; payments 2–N are emailed on their due dates."
- Keep the per-invoice "Send now" action for sending one early.

### 4. Make the nightly job's status visible
Add a line on the admin dashboard showing when scheduled sending last ran and how many invoices went out, so a job that is not running is obvious rather than silent.

## Technical notes

- `dispatchInvoice` (`src/lib/invoicing.server.ts`) currently updates status before calling `emailInvoice` and ignores `result.sent`. Reorder: send first, set `sent`/`sent_at` only on success; on failure write a `delivery_error` and leave the prior status. Audit entry already carries `emailed`.
- `createDirectInvoice` (`src/lib/direct-invoice.functions.ts`) inserts every row with `status: "draft"`. Rows after the first become `status: "scheduled"` (they already carry `scheduled_send_at` from `paymentPlanToInvoiceEntries`), which `runScheduledWork` picks up.
- New nullable columns on `public.invoices`: `delivery_error text`, `delivery_attempted_at timestamptz`. Mirrored into `supabase/schema/012_invoice_delivery_state.sql`.
- Surface delivery state in `listQuotes` (`invoicesByQuote`) and in the nested invoice rows on `/admin` and the project page; Retry calls the existing `sendInvoiceNow`.
- Cron heartbeat: record last run + counts from `runScheduledWork` into `app_settings`, read by the admin dashboard.
- Tests: `dispatchInvoice` does not mark sent on a failed send; split creation yields one `draft`/sent first row and `scheduled` remainder summing to the total.

## 5. Make the project choice explicit on the new invoice form

Right now the form quietly pre-selects the client's most recent project, so a new bill can land under an existing job without the team noticing. Change it to a visible choice at the top of the Project step: "Add to an existing project" (with the project list, most recent pre-selected) or "Start a new project", with a one-line note saying where the invoice will appear. Nothing is saved until one is picked.
