# Payment migration: Hyperswitch to Braintree, with sandbox/live control

## What exists today

Payments already work end to end through Hyperswitch, with Braintree as the sandbox connector behind it:

- Clients pay from the invoice page and from the portal; card is on, bank (ACH) is off.
- Admins toggle card/ACH from the admin dashboard; the toggle is enforced on the server too.
- Every attempt is recorded, signed provider notifications update the invoice, duplicate notifications are ignored, and stale abandoned attempts expire.
- Refund records exist in the database but there is no refund button anywhere.
- The environment (sandbox or live) is fixed by a stored setting, not something you can change in the app.

Nothing about quotes, estimates, SOWs, invoices, clients or emails changes in this work.

## What changes

1. **A payment layer with two providers.** The invoice code stops talking to Hyperswitch directly and talks to one internal payment service instead. That service has two interchangeable back ends: the existing Hyperswitch one (kept as a fallback) and a new direct Braintree one. Which one is active is an admin setting.

2. **Direct Braintree integration.** Server-side Braintree calls for client tokens, charging a validated amount, checking status, and refunds. Client-side Braintree Drop-in on the invoice page, styled to match the current payment card so the client experience looks the same. Braintree webhooks arrive at a new signed endpoint and update invoices exactly the way the Hyperswitch webhook does today.

3. **Sandbox / live switching.** A new admin card shows the active provider and a clear badge: `SANDBOX / TEST MODE` or `PRODUCTION / LIVE MODE`. Switching to live opens a confirmation dialog with the warning that payments become real transactions. Only admins can switch; the server checks the admin role on every change and never trusts the browser. Each switch is written to the audit log with who, from, to and when. Sandbox and live credentials are stored as separate secrets and are never sent to the browser.

4. **ACH.** Braintree ACH Direct Debit is only offered when your Braintree account has it enabled. The admin toggle stays, but if Braintree reports it unavailable the admin card says so and clients are never shown it.

5. **Refunds.** Admins get a refund action on paid invoices: full or partial, processed through the provider, recorded with amount, reason, admin, provider reference and status, and reflected in the invoice balance.

6. **Payment history stays.** Existing payment, refund and event rows are untouched. New columns mark which provider and which environment each record belongs to.

## Rollout order

1. Build the payment layer and move existing Hyperswitch code behind it (no behaviour change).
2. Add the Braintree back end plus environment switching, defaulting to sandbox.
3. Run the full sandbox test pass: card success, card decline, cancel, duplicate click, partial and full payment, invoice status, webhook, duplicate webhook, refund, ACH if enabled, toggles, and an unauthorised environment-switch attempt.
4. Only after that passes, switch the provider setting to Braintree and the environment to live with your live credentials.
5. Remove Hyperswitch code in a later, separate step once live Braintree has been running cleanly.

## Technical notes

- Database migration: `provider` and `environment` columns on `invoice_payments` and `refunds` (defaulting existing rows to `hyperswitch` / `sandbox`), generic `provider_payment_id` / `provider_refund_id` columns alongside the existing Hyperswitch ones, and `payment_provider` / `payment_environment` keys in `app_settings`.
- New `src/lib/payments/provider.ts` interface (`createPayment`, `getPayment`, `refund`, `availableMethods`, `parseWebhook`) with `hyperswitch.provider.server.ts` and `braintree.provider.server.ts` implementations; `service.server.ts` resolves the active one from settings.
- Braintree is called over its GraphQL API with `fetch` (the Node SDK is not Worker-safe). Secrets: `BRAINTREE_SANDBOX_MERCHANT_ID/PUBLIC_KEY/PRIVATE_KEY`, the same four for `_LIVE`, plus tokenization keys for Drop-in. Credentials are read inside handlers only, selected by the active environment.
- New signed route `src/routes/api/public/braintree/webhook.ts`, verifying Braintree's `bt_signature`/`bt_payload`, reusing the existing `payment_events` idempotency insert and `applyPaymentStatus` / `applyRefundStatus`.
- Server-side amount authority is unchanged: the outstanding balance is recomputed from the invoice before any charge, and the duplicate/pending checks already in `invoicing.server.ts` are reused.
- Tests extend the existing Vitest suites: provider selection and isolation, unauthorised switch, status mapping, webhook signature valid/invalid/duplicate, refund full/partial/failed, method toggles, and full/partial invoice status.
