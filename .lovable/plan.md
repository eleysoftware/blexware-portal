# Fix project balance, installment schedule, and payment emails

## Goal

After the $1,000 first payment on BLX-2026-0002, show the client that the current
invoice is paid while the project still has six $600 installments ($3,600) remaining.
Send the receipt, but do not send a paid-in-full message until the complete project
payment plan has been settled.

## Confirm and repair BLX-2026-0002

- Inspect the quote's signed agreement, stored payment plan, invoice rows, payment
  records, and scheduled send dates before changing its data.
- The current implementation is designed to create every invoice row when BLEXware
  countersigns the SOW, keep future rows in `scheduled` status, and issue/email them
  later through the scheduled worker. Database access is currently disabled, so the
  actual rows for BLX-2026-0002 are not yet confirmed.
- If all seven rows exist, preserve them and correct only the calculations and UI.
- If only invoice 1 exists, idempotently create the six missing $600 scheduled rows
  from the signed agreement's stored payment plan. Preserve the paid invoice and its
  payment/audit history; never duplicate an existing sequence.
- If the stored payment plan itself does not total $4,600, stop and report the mismatch
  rather than inventing installment amounts or dates.

## Correct the source of truth

- Add one server-side project payment summary that reconciles the signed agreement's
  payment plan with invoice rows. It returns project total, paid to date, remaining
  balance, installment count, and upcoming schedule.
- Count scheduled/unissued installments in the remaining project balance. Exclude only
  void/cancelled invoices and avoid double-counting a payment-plan entry that already
  has an invoice row.
- Keep the current invoice balance separate from the project balance: invoice 1 can be
  `$0 due` while the project correctly shows `$3,600 remaining`.
- Make schedule creation idempotent so retries or repeated countersigning cannot create
  duplicate installments.

## Emails

- Continue sending one receipt for each successful payment.
- Remove the automatic second `paid_in_full` email when only the current invoice reaches
  zero. Send that message only when the project-wide remaining balance is zero.
- For an intermediate payment, include the $3,600 project balance, six remaining
  installments, and the next scheduled send date in the receipt when available.
- Apply the same project-level wording to the internal team notification.

## Client invoice page

- Keep **Amount due** tied to the currently payable invoice.
- Add a **Project payment schedule** showing project total, paid to date, project balance,
  and each future installment's amount and scheduled send/due date.
- Show future installments as read-only schedule entries. Do not expose a pay action or
  active payment link until an installment is issued.
- After payment confirmation, refresh both the invoice and project summary so the success
  panel immediately shows `$3,600 remaining`, not `$0`.

## Admin invoices tab

- Add the same total / paid / remaining summary above the invoice list.
- Clearly distinguish scheduled, issued, partially paid, and paid installments so the
  team can confirm all seven parts of the $4,600 plan.

## Technical implementation

- Update `src/lib/invoicing.server.ts` to centralize the project summary, repair missing
  schedule rows safely, and gate completion/email behavior on the project balance.
- Update `src/lib/engagement-email.server.ts` so receipt and paid-in-full copy receives
  project-level balance details.
- Extend `getInvoiceByToken` in `src/lib/invoice.functions.ts` with a client-safe project
  summary and upcoming schedule; keep scheduled invoice tokens private.
- Render the summary in `src/routes/invoice.$token.tsx` and
  `src/components/admin/AdminEngagementPanel.tsx`.
- No schema migration is expected; the signed agreement document and existing invoice
  columns already hold the required payment-plan data.

## Verification

- Add regression coverage for a $4,600 plan split into $1,000 + six $600 installments.
- Verify paying invoice 1 leaves `$3,600` project balance, sends one receipt, does not
  send `paid_in_full`, and does not mark the quote completed.
- Verify the final installment produces a zero project balance, marks completion, and
  sends the final paid-in-full notification once.
- Verify schedule repair creates only missing sequences and is safe to run repeatedly.
- Verify the client cannot pay or obtain pay links for unissued scheduled installments.
