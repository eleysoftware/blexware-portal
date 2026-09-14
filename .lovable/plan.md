# Payment migration: Hyperswitch to PayPal Business, with sandbox/live control

## What exists today

Payments already work end to end through Hyperswitch (Braintree sandbox connector behind it):

- Clients pay from the invoice page and from the portal; card is on, bank (ACH) is off.
- Admins toggle card/ACH from the admin dashboard; the toggle is enforced on the server too.
- Every attempt is recorded, signed provider notifications update the invoice, duplicate notifications are ignored, and stale abandoned attempts expire.
- Refund records exist in the database but there is no refund button anywhere.
- The environment (sandbox or live) is fixed by a stored setting, not something you can change in the app.

Nothing about quotes, estimates, SOWs, invoices, clients or emails changes in this work.

## What changes

1. **A payment layer with two providers.** The invoice code stops talking to Hyperswitch directly and talks to one internal payment service instead. That service has two interchangeable back ends: the existing Hyperswitch one (kept as a fallback) and a new direct PayPal one. Which one is active is an admin setting.

2. **Direct PayPal Business integration.** Server-side PayPal calls to create an order for the validated amount, capture it, read its status, and issue refunds. On the invoice page, the PayPal buttons render inline inside the BLEXware payment card — the client never leaves the site. A client can pay with their PayPal balance or account; where your account is approved for it, a card form is shown for clients who don't have PayPal. PayPal's modal/overlay opens over the page, then the client returns to the invoice confirmation. PayPal webhooks arrive at a new verified endpoint and update invoices exactly the way the Hyperswitch webhook does today.

3. **Sandbox / live switching.** A new admin card shows the active provider and a clear badge: `SANDBOX / TEST MODE` or `PRODUCTION / LIVE MODE`. Switching to live opens a confirmation dialog with the warning that payments become real transactions. Only admins can switch; the server checks the admin role on every change and never trusts the browser. Each switch is written to the audit log with who, from, to and when. Sandbox and live credentials are stored as separate secrets and are never sent to the browser.

4. **ACH.** PayPal does not offer a general ACH bank-debit option for US merchants the way the old setup anticipated; US clients can still fund a PayPal payment from their bank through their PayPal account. The admin ACH toggle stays in place, but the admin card states plainly that bank debit isn't available on PayPal, and clients are never shown an option that can't complete.

5. **Refunds.** Admins get a refund action on paid invoices: full or partial, processed through PayPal, recorded with amount, reason, admin, provider reference and status, and reflected in the invoice balance.

6. **Payment history stays.** Existing payment, refund and event rows are untouched. New columns mark which provider and which environment each record belongs to.

## Rollout order

1. Build the payment layer and move existing Hyperswitch code behind it (no behaviour change).
2. Add the PayPal back end plus environment switching, defaulting to sandbox.
3. Run the full sandbox test pass: successful payment, declined payment, cancel, duplicate click, partial and full payment, invoice status, webhook, duplicate webhook, refund, toggles, and an unauthorised environment-switch attempt.
4. Only after that passes, switch the provider setting to PayPal and the environment to live with your live credentials.
5. Remove Hyperswitch code in a later, separate step once live PayPal has been running cleanly.

## Technical notes

- Database migration: `provider` and `environment` columns on `invoice_payments` and `refunds` (existing rows default to `hyperswitch` / `sandbox`), generic `provider_payment_id` / `provider_refund_id` columns alongside the existing Hyperswitch ones, and `payment_provider` / `payment_environment` keys in `app_settings`.
- New `src/lib/payments/provider.ts` interface (`createPayment`, `getPayment`, `refund`, `availableMethods`, `parseWebhook`) with `hyperswitch.provider.server.ts` and `paypal.provider.server.ts` implementations; `service.server.ts` resolves the active one from settings.
- PayPal is called over the Orders v2 and Payments REST APIs with `fetch` (OAuth2 client-credentials token, cached per environment) — no Node-only SDK. Browser side loads the PayPal JS SDK with the environment's client ID only. Secrets: `PAYPAL_SANDBOX_CLIENT_ID/SECRET/WEBHOOK_ID` and `PAYPAL_LIVE_CLIENT_ID/SECRET/WEBHOOK_ID`, read inside handlers and selected by the active environment. API base switches between `api-m.sandbox.paypal.com` and `api-m.paypal.com`.
- New route `src/routes/api/public/paypal/webhook.ts`, verifying events through PayPal's webhook-signature verification endpoint, reusing the existing `payment_events` idempotency insert and `applyPaymentStatus` / `applyRefundStatus`. Handles `CHECKOUT.ORDER.APPROVED`, `PAYMENT.CAPTURE.COMPLETED/DENIED/REFUNDED`.
- Server-side amount authority is unchanged: the outstanding balance is recomputed from the invoice before any order is created, capture is server-initiated, and the duplicate/pending checks already in `invoicing.server.ts` are reused.
- Tests extend the existing Vitest suites: provider selection and isolation, unauthorised switch, PayPal status mapping, webhook valid/invalid/duplicate, refund full/partial/failed, method toggles, and full/partial invoice status.
- Future: migrate the PayPal buttons to PayPal Advanced Card Payments for a fully white-labelled card form. This is intentionally out of scope for the MVP.
