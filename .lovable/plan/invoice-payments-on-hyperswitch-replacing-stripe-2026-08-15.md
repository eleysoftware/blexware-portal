# Invoice payments on Hyperswitch (replacing Stripe)

Swap the invoice payment layer from Stripe to Hyperswitch Cloud, behind a processor-agnostic `PaymentService`. Everything else in the quote → proposal → estimate → SOW → invoice pipeline stays as it is, including the $600 installment schedule and the biweekly cron that sends invoices.

## What changes for customers

- The invoice link (`/invoice/<token>`) becomes a proper payment page: BLEXware logo and name, invoice number, client/business name, issue date, due date, description, original amount, amount already paid, remaining balance, status badge, secure-payment note.
- Two payment choices, ACH shown first and framed as preferred:
  - **Pay by Bank — Recommended** ("Securely connect your bank account to pay directly from your bank.")
  - **Credit or Debit Card**
- Card and bank details are collected only by the Hyperswitch Unified Checkout widget; BLEXware never sees or stores account, routing, card or CVV data.
- After paying: card success shows "Payment Successful" with invoice number, amount, method, date, reference and remaining balance. ACH shows "Payment Submitted — your bank payment is processing"; the invoice only flips to paid when the backend confirms it. No "balance verified" or "guaranteed" language anywhere.
- Page is responsive (phone/tablet/desktop), keyboard navigable, with visible focus states, labelled inputs, readable errors, and status conveyed by text plus icon, not color alone.

## What changes for admins

A **Payments** section in the admin area, plus a payments block on each quote detail page, showing per invoice: number, client, total, paid, remaining, status, method, payment date, processor, Hyperswitch payment ID, processor transaction ID, fees when reported, refund status. Admin actions: view payment history, issue full or partial refund, record an offline payment (check/transfer), re-check ("reconcile") a stuck payment against Hyperswitch, and download a receipt. No credentials are ever shown.

## Emails

Reuse the existing ZeptoMail transport. Triggered from our own records, not the browser: invoice ready, payment submitted, ACH processing, payment succeeded, payment failed, invoice paid in full, refund issued.

## Technical plan

**Phase 1 — remove Stripe.** Delete `src/routes/api/public/stripe/webhook.ts`, drop the Stripe fetch code from `src/lib/invoicing.server.ts`, and stop requiring `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET`. The existing cron already uses `CRON_SECRET` and stays. Invoice scheduling, dispatch and the SOW→invoice hook are preserved.

**Phase 2 — data model** (migration `005_hyperswitch_payments.sql`, extending what exists rather than rebuilding):
- `public.invoices`: drop `stripe_session_id` / `stripe_payment_intent`; add `issue_date`, `currency` (default `usd`), `amount_paid_cents` (default 0), `description`, `viewed_at`; widen `invoice_status` enum with `draft`, `viewed`, `partially_paid`, `overdue`, `cancelled` (existing `scheduled`/`sent`/`paid`/`void` kept so current rows stay valid). `pay_token` remains the public URL token — no internal IDs exposed.
- `public.invoice_payments`: invoice_id, payment_reference, hyperswitch_payment_id, connector, amount_cents, currency, payment_method, status (`created|processing|succeeded|failed|cancelled|refunded|partially_refunded|disputed|action_required`), processor_transaction_id, failure_code, failure_message, fee breakdown jsonb (processor/hyperswitch/network/refund/chargeback/other), paid_at, timestamps.
- `public.payment_events`: invoice_payment_id, event_type, `event_id` **unique** (idempotency), payload jsonb, signature_verified, received_at, processed_at.
- `public.refunds`: invoice_payment_id, amount_cents, reason, initiated_by, hyperswitch_refund_id, processor_refund_id, status, timestamps.
- The old `public.payments` table is retired (data migrated into `invoice_payments`).
- Same grant/RLS pattern already used: `service_role` full, `authenticated` select, admin-read policies via `has_role`, client-read scoped by `viewer_email()`.

**Phase 3 — PaymentService.** New `src/lib/payments/hyperswitch.server.ts` (thin REST client over the Hyperswitch Cloud API) and `src/lib/payments/service.server.ts` exposing `createPayment`, `getPayment`, `cancelPayment`, `refundPayment`, `getPaymentStatus`. Invoicing code calls only this service — no connector name is hard-coded, Helcim is configured inside Hyperswitch. Secrets read inside handlers: `HYPERSWITCH_API_KEY`, `HYPERSWITCH_PROFILE_ID`, `HYPERSWITCH_PUBLISHABLE_KEY`, `HYPERSWITCH_WEBHOOK_SECRET`, `HYPERSWITCH_ENVIRONMENT` (sandbox/production). Until the account is live, the service surfaces a clear "payments not configured yet" error — no Stripe fallback.

**Phase 4 — payment page.** `src/lib/invoice.functions.ts` gains `createInvoicePayment`, which loads the invoice server-side, verifies it is payable, computes `total - amount_paid` **on the server**, creates the Hyperswitch payment with that amount, and returns only the client secret, publishable key and profile ID. Any amount sent by the browser is ignored. `src/routes/invoice.$token.tsx` is rebuilt to mount Hyperswitch Unified Checkout (loaded client-side only) with ACH listed first, and records `viewed_at` on first open.

**Phase 5–8 — webhooks and invoice sync.** New `src/routes/api/public/hyperswitch/webhook.ts` verifies the HMAC signature over the raw body, rejects unsigned/invalid events, inserts a `payment_events` row keyed by `event_id` (duplicate → 200, no-op), then updates payment and invoice state for `payment_*`, `action_required`, `refund_*`, `dispute_opened`, `mandate_*`. Out-of-order events never downgrade a terminal state. Invoice becomes `partially_paid` or `paid` from confirmed events only; when all invoices for a quote are paid, the quote flips to `completed` as it does today. Failed attempts are preserved and retry creates a new attempt.

**Phase 9–10.** Receipt/notification emails wired to those state changes, then an admin reconcile action and a `processing`-payment sweep added to the existing cron worker.

Every state change also writes to the existing `audit_log` (invoice created/sent/viewed, payment created/processing/succeeded/failed/refunded/disputed, invoice partially paid/paid) with actor, timestamps and external references.

## Setup you'll need to provide

Once your Hyperswitch Cloud account and Helcim connector are approved, I'll need these as project secrets: `HYPERSWITCH_API_KEY`, `HYPERSWITCH_PUBLISHABLE_KEY`, `HYPERSWITCH_PROFILE_ID`, `HYPERSWITCH_WEBHOOK_SECRET`, `HYPERSWITCH_ENVIRONMENT`. ACH/Plaid and card methods are enabled in the Hyperswitch dashboard, not in code. Until then the payment page builds and renders, and shows a configuration notice instead of the checkout widget.
