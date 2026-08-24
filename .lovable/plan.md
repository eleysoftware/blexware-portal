# Activate SOW signing + invoice payments (ACH / debit / credit)

Most of this pipeline already exists in the app: SOW generation from the approved estimate, the client's typed e-signature, BLEXware's automated countersignature at project start, the $600 installment invoice schedule, and a Hyperswitch-backed invoice payment page. It is currently dormant because no gateway credentials are configured, and the payment page shows one combined widget instead of an explicit method choice. This plan turns it on, adds the method chooser, and surfaces payout status to admins.

## 1. Turn on the gateway (sandbox)

Store your sandbox credentials as project secrets: `HYPERSWITCH_API_KEY`, `HYPERSWITCH_PUBLISHABLE_KEY`, `HYPERSWITCH_PROFILE_ID`, `HYPERSWITCH_WEBHOOK_SECRET`, and `HYPERSWITCH_ENVIRONMENT=sandbox`. No card, bank, or routing numbers are ever stored in this app — the gateway collects them, and BLEXware's own payout bank account stays configured in the Hyperswitch/connector dashboard only.

Webhook endpoint to register in the Hyperswitch dashboard: `https://blexware.com/api/public/hyperswitch/webhook` (signature-verified, already implemented).

## 2. Payment method chooser on the invoice page

The client first picks how they want to pay, then only that form loads:

- **Pay by Bank (ACH) — Recommended** — "Securely connect your bank account to pay directly from your bank."
- **Credit or Debit Card**

Behavior: choosing a method starts a server-side payment restricted to that method family, mounts the gateway's hosted fields for it, and shows a "change payment method" link back to the chooser. Card success shows "Payment Successful" with invoice number, amount, method, date, reference and remaining balance; ACH shows "Payment Submitted — your bank payment is processing" and the invoice only flips to paid when the webhook confirms it. Keyboard-navigable radio-card selection, visible focus, status by text plus icon.

## 3. SOW signing: make both signatures explicit

The client signature and BLEXware countersignature already exist but are shown in separate places. The SOW tab will show a single signature block listing both parties with name, title, signature text, timestamp, and (for the client) the document hash, plus a clear "waiting on BLEXware to countersign" state between the two events. Signed PDF/DOCX remain downloadable to both sides.

## 4. Invoices + admin payments view

- Invoice list per quote already renders; add remaining-balance and method columns, plus a "Send now" / "Copy pay link" pair for each scheduled invoice.
- Payments block gets a **payout status** panel: read-only settlement/payout information pulled from the gateway for succeeded payments (payout state, expected deposit date, fees when reported). No credentials are displayed.
- Existing admin actions stay: refund (full/partial), record offline payment, reconcile a stuck payment, download receipt.

## 5. Verification

End-to-end sandbox run on Tamara West's project: countersign → invoice 1 sends → pay with a sandbox test card → webhook marks paid → quote advances; then a sandbox ACH run to confirm the "processing → paid" transition. Unit tests added for the method-restricted payment creation and the payout-status mapping.

## Technical notes

- `PaymentService.createPayment` gains an optional `methods: "bank" | "card"` argument mapped to Hyperswitch `payment_method_types` (`ach` vs `credit`/`debit`); the amount stays server-computed from the invoice, browser input ignored.
- `beginInvoicePayment` accepts the chosen method only; every other amount/state decision remains server-side.
- New payout read added to `service.server.ts` and exposed through the existing admin engagement server function — no new tables required; `invoice_payments.fees`/`metadata` hold the gateway detail.
- `src/routes/invoice.$token.tsx` and `src/components/HyperswitchCheckout.tsx` handle the chooser; `src/components/admin/AdminEngagementPanel.tsx` and `EngagementPanel.tsx` handle the SOW signature block and payout panel.
