# Let admins change an invoice's status

## What's actually blocking payment today

Reading the code: a **draft** invoice link *does* open and *can* be paid. The states that block a client are **scheduled**, **void** and **cancelled** — those links show "invoice not found", and a scheduled payment stays that way until the nightly mail job sends it. So when email is failing, a split payment sitting in "scheduled" is the one the client can't pay from a copied link.

The fix is the same either way: give the team a direct way to set an invoice's status, so a copied payment link works immediately.

## What I'll add

A **status control on each invoice row** — in the team queue on `/admin` and on the project page — next to the existing Retry and Copy payment link actions.

Choosing a new status:
- asks for confirmation, naming the invoice and the change
- saves it without sending any email (nothing is mailed by this action)
- records who changed it and when, in the activity log
- refreshes the row so the badge and available actions update

Allowed changes, kept deliberately narrow so money records stay trustworthy:

| From | Can be set to |
| --- | --- |
| draft, scheduled | sent (open for payment), cancelled |
| sent, viewed, overdue | scheduled (hold it back), cancelled |
| partially paid | cancelled |
| paid | — no change |

"Paid" is never something the team sets by hand; it only comes from a real payment. A cancelled invoice can be reopened to "sent" too, in case something is cancelled by mistake.

Alongside it, a one-line hint on rows that a client cannot open yet: "Client can't open this link yet — set it to Sent." on scheduled invoices, so the reason is visible rather than guessed.

## Technical notes

- New admin-only server function `setInvoiceStatus` in `src/lib/engagement.functions.ts` (same auth middleware as `sendInvoiceNow`): validates the current → next pair against an allow-list, updates `public.invoices.status`, sets `sent_at` when moving into `sent` and it is null, clears `scheduled_send_at` when leaving `scheduled`, writes an `invoice.status_changed` audit row with `{ from, to }`. Rejects any transition out of `paid` or into `paid`/`partially_paid`.
- Transition map lives in a small client-safe module (`src/lib/invoice-status.ts`) exporting `allowedInvoiceTransitions(status)` and human labels, so the admin UI and the server share one source of truth; unit-tested.
- UI: a shadcn `Select` (or dropdown menu) rendered in the invoice row action cluster in `src/routes/_authenticated/admin/index.tsx` and the invoices tab of `src/routes/_authenticated/admin/quotes/$id.tsx`, wrapped in an `AlertDialog` confirmation; invalidates the `["admin-quotes", …]` query on success. Status values come from `invoicesByQuote` which already carries `status`.
- No schema change: `invoice_status` already includes every value used here.
- Tests: transition map rejects paid/partially-paid edits and permits scheduled → sent; `setInvoiceStatus` writes the audit entry and does not send email.
