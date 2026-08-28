# Fix invoice balance display and the wrong "paid in full" email

## What went wrong

Two separate problems came out of the $1,000 payment on BLX-2026-0002.

**1. "Remaining balance $0" is the wrong number to show.**
The invoice page only ever shows the balance of *that one invoice*. Invoice #1 was
$1,000 and $1,000 was paid, so it correctly reads $0 — but what you (and the client)
want to see is the remaining balance on the whole project: the six later $600
invoices, $3,600 outstanding.

**2. The "invoice paid in full" email is per-invoice, not per-project.**
On a successful payment the system sends a receipt, and then — when that single
invoice reaches a zero balance — a second "This invoice is paid in full" email. For
a multi-invoice schedule that second email is noise and reads as if the project is
settled. It should only go out when the last outstanding invoice on the project is
paid; otherwise the receipt alone is enough.

## Unverified: do the other six invoices exist?

I could not confirm this — the database read tool is disabled for this project, so I
can't list the invoices for BLX-2026-0002. Step 1 of the work is to check the
Invoices tab of that quote's admin workspace and confirm seven rows exist
($1,000 + 6 x $600 = $4,600). If they don't, the payment plan stored on the signed
SOW is the cause and that gets fixed separately — I'll report back before changing
schedule generation.

## Changes

### Emails
- On a successful payment, always send the receipt.
- Compute the project-wide outstanding balance (all invoices for the quote that are
  not void/cancelled, minus amounts paid).
- Only send the "paid in full" email when that project balance is zero.
- When the project still has a balance, the receipt/update email states the remaining
  project balance and how many invoices are left, instead of "remaining balance on
  this invoice".
- Internal team notification wording follows the same rule.

### Client invoice page (`/invoice/$token`)
- Keep "Amount due" as this invoice's balance (correct for paying).
- Add a project summary block under the invoice details: project total, paid to date,
  remaining across all invoices, and the count of upcoming invoices with their dates
  and amounts, so a client paying invoice 1 of 7 sees $3,600 still scheduled.
- If it's the only invoice, the summary is omitted.

### Admin
- Invoices tab shows the same project-level roll-up (total / paid / outstanding) above
  the invoice list.

## Technical notes

- `src/lib/invoicing.server.ts` `applyPaymentOutcome` (~lines 346-405): the
  `balance === 0` branch already queries outstanding invoices for the quote to mark it
  completed. Move that query above the email block and gate the `paid_in_full` email
  on it; pass the project balance into `emailPaymentUpdate`.
- `src/lib/engagement-email.server.ts`: `emailPaymentUpdate` gains a
  `projectBalanceCents` / `remainingInvoices` shape and its copy is reworded.
- `src/lib/invoice.functions.ts` `getInvoiceByToken`: return a `project` object
  (totalCents, paidCents, balanceCents, upcoming invoice rows) alongside the invoice.
- `src/routes/invoice.$token.tsx` and
  `src/components/admin/AdminEngagementPanel.tsx` render the new summary.
- No database migration is needed; all values are derived from existing
  `invoices.amount_cents` / `amount_paid_cents`.
