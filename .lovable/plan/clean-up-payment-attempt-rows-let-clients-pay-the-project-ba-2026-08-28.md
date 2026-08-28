# Clean up payment attempt rows + let clients pay the project balance in full

## What those four extra lines are

Each time a client clicks "Continue to pay", the app records a payment attempt row before the
checkout widget opens. If the client closes the page, switches method, or the card widget never
finishes, that attempt stays behind at status `created` or `action_required`, with no connector
assigned yet (hence "unassigned connector"). Only the last row — `succeeded · braintree` — is a real
payment. So the four lines are abandoned/stale checkout attempts, not money owed or collected.

## Part 1 — Make the admin invoice list clean

- Collapse abandoned attempts: only show attempts that matter — `succeeded`, `processing`,
  `failed`, `cancelled`, `refunded`. Stale `created` / `action_required` rows older than ~30 minutes
  are hidden behind a small "Show N abandoned attempts" toggle per invoice.
- Auto-expire stale attempts: when the admin engagement view loads, attempts stuck in
  `created`/`action_required` for over 30 minutes are marked `expired` (no gateway call, no money
  effect). Recent in-flight attempts are left alone so a client mid-checkout isn't disturbed.
- Tidy the row text: show `amount · method · date · status` with the connector and processor id
  moved into a muted secondary line, and drop the "unassigned connector" placeholder entirely.
- Hide "Reconcile" on attempts with no gateway payment id (nothing to reconcile) and keep the
  refund controls only on succeeded attempts.

## Part 2 — Pay the remaining balance in full

On the client invoice page, when the project has more than one installment and an outstanding
project balance, offer two amount choices above the payment method:

- Pay this installment — the current invoice balance (default).
- Pay the full remaining balance — the whole project balance across all scheduled installments.

The amount stays server-computed: the payment is started with a `scope` of `invoice` or `project`,
and the server derives the amount from the project payment summary — the client never sends a price.

When a full-balance payment succeeds, the server allocates the money to invoices in sequence order:
each is credited up to its amount and marked `paid`, and any still-scheduled installments are issued
as paid rather than being emailed later. The receipt and the "paid in full" email then reflect a
zero project balance once, and no future installment emails go out.

Admin side: the invoice card shows a "Paid via full-balance payment on INV-xxxx" note on the
installments settled by that single payment, so the money trail stays clear.

## Technical notes

- `src/lib/invoicing.server.ts`: add `expireStaleAttempts(quoteId)`; extend `startInvoicePayment`
  with `scope: "invoice" | "project"` computing the amount from `getProjectPaymentSummary`; add
  allocation of a succeeded payment across installments inside `applyPaymentStatus`.
- `src/lib/invoice.functions.ts`: pass `scope` through the validator; return `projectBalanceCents`
  and installment count so the UI can offer the choice.
- `src/routes/invoice.$token.tsx`: amount-choice radio group, plus updated pay button label.
- `src/components/admin/AdminEngagementPanel.tsx`: attempt filtering, toggle, tidier row layout.
- `src/lib/engagement.functions.ts`: call `expireStaleAttempts` alongside the existing schedule check.
- Tests: unit coverage for allocation across installments and for stale-attempt filtering.
