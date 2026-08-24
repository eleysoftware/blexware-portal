# Sandbox verification run: SOW signing through invoice payment

Now that the gateway secrets are stored (`HYPERSWITCH_API_KEY`, `HYPERSWITCH_PUBLISHABLE_KEY`, `HYPERSWITCH_PROFILE_ID`, `HYPERSWITCH_WEBHOOK_SECRET`, plus `HYPERSWITCH_ENVIRONMENT=sandbox` and `PAYMENTS_PROVIDER=hyperswitch`), this is the end-to-end proving run on Tamara West's project. No new features — verify, and fix only what the run breaks.

## 0. Prerequisite you own

Register the webhook in the Hyperswitch dashboard against the preview build so callbacks land before publishing:

- Preview: `https://project--464d1e70-9d8e-4191-938a-125ef3036961-dev.lovable.app/api/public/hyperswitch/webhook`
- Production: `https://blexware.com/api/public/hyperswitch/webhook`

The handler verifies the HMAC signature over the raw body, so the dashboard secret must match the stored `HYPERSWITCH_WEBHOOK_SECRET` exactly.

## 1. Configuration smoke check

Confirm the app now reports payments as configured: the invoice page should render the method chooser instead of the "arrange payment directly" fallback, and the admin invoice block should offer "Send now" / "Copy pay link". If the fallback still shows, the cause is a name mismatch in `src/config/payments.ts`'s fallback chain, not the page.

## 2. Card path (happy path)

1. Admin countersigns / starts the project on Tamara West's quote (`approveProjectStart`), which triggers the invoice schedule.
2. Admin uses "Send now" on invoice 1 and copies the pay link.
3. Open the pay link, choose **Credit or Debit Card**, pay with a Hyperswitch sandbox test card.
4. Expect: "Payment Successful" with invoice number, amount, method, date, reference, remaining balance.
5. Confirm the webhook arrived and marked the invoice paid (server logs + the invoice row), and that the quote/stage advanced.
6. Confirm the admin payout panel shows settlement detail (net, fees, connector, settled date) for that payment.

## 3. ACH path

Repeat with **Pay by Bank (ACH)** using the sandbox bank test credentials. Expect "Payment Submitted — your bank payment is processing" and the invoice staying unpaid until the webhook confirms, then flipping to paid. This is the transition most likely to expose a status-mapping gap.

## 4. Fix scope if something fails

Only these, and only if the run surfaces them:

- Method restriction rejected by the gateway → adjust the `allowed_payment_method_types` values in `src/lib/payments/service.server.ts` (`METHOD_TYPES`) to the exact sandbox connector's supported types.
- Webhook 401 → signature algorithm/header name mismatch in `src/routes/api/public/hyperswitch/webhook.ts`.
- ACH intermediate status not mapped → extend the status map in `src/lib/payments/service.server.ts` and cover it in `tests/unit/payment-status.spec.ts`.

## 5. Close out

Run the unit suite, then report per step: what passed, the payment references used, and anything left dormant. Publish afterwards so production picks up the new secrets — unprefixed secrets only reach the live site on publish.

## Technical notes

- Actions exercised: `approveProjectStart`, `sendInvoiceNow`, `getPaymentSettlement` (admin), `getInvoiceByToken`, `beginInvoicePayment`, `confirmInvoicePayment` (client).
- Amounts stay server-computed from the invoice row; the chooser only passes the method family.
- Verification uses the preview build plus server logs; no schema changes and no new dependencies.
