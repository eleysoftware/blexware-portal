# Finish the sandbox run + make SOW and invoice generation visible

Two parts: exact steps for the checks I can't run myself, and a rebuild of the SOW and Invoices tabs so generation is where you expect it, AI-assisted, and configurable.

## Part 1 — What I couldn't run, and exactly how to do it

I can't sign in to your app: this project uses an external Supabase that Lovable can't mint a session for, so automated browser runs have no admin login. I also can't reach your Hyperswitch dashboard. Everything below is a one-time manual pass; after each step tell me what you saw and I'll fix from there.

1. **Register the webhook.** Hyperswitch dashboard → Developers → Webhooks → add endpoint
   `https://blexware.com/api/public/hyperswitch/webhook`, events: payment succeeded/failed/processing and refund updates. The signing secret there must match the `HYPERSWITCH_WEBHOOK_SECRET` already stored in the project.
2. **Enable an ACH connector.** Card works in sandbox today; ACH returns `IR_39` because no connector in your Hyperswitch account is eligible for it. Turn on ACH debit for your sandbox connector (Helcim or a sandbox processor that supports `ach`). Until then the invoice page correctly hides the bank option.
3. **Countersign the SOW** for Tamara West: Admin → the quote → SOW tab → set the project start date → "Approve & countersign". Expected: invoice 1 appears with a due date three days before the start date.
4. **Send invoice 1** from the Invoices tab ("Send now"), then open the emailed pay link (or "Copy pay link").
5. **Pay with a sandbox card** — `4242 4242 4242 4242`, any future expiry, any CVC. Expected: "Payment Successful" with invoice number, amount, method, date, reference and remaining balance; the admin Invoices tab flips to paid and "Payout status" returns settlement detail.
6. **ACH run** (after step 2) with the gateway's test bank account. Expected: "Payment Submitted — processing", then paid once the webhook lands.

Report to me: the exact on-screen text of any error, and whether the invoice status changed. That tells me whether the problem is credentials, connector eligibility, or webhook signature.

## Part 2 — SOW and invoices in the UI

### Why the button seems missing

"Generate & send SOW" exists, but it is rendered at the bottom of the **Estimate** tab and only when the estimate row's status is exactly `approved` — not in the SOW tab where you're looking. If the estimate on that quote isn't in `approved` state (for example the client approved but the row didn't advance), nothing renders at all and the SOW tab just shows an empty-state message. First step is confirming which of those two it is on quote `61941fde…`; the rest of the work removes the ambiguity either way.

### SOW tab rework

- The SOW tab owns the whole SOW lifecycle: a status line ("Waiting on approved estimate" / "Ready to generate" / "Sent for signature" / "Signed — awaiting countersignature" / "Countersigned"), and the generate/send buttons live here, always visible with a clear reason when disabled.
- **Draft SOW with AI** button plus the model picker: AI writes scope, deliverables, assumptions, exclusions, milestones and acceptance criteria from the approved estimate and proposal. Output lands in an editable field; nothing is sent until you press send. Drafts stay drafts requiring human review, as always.
- Regenerate with a change request, same pattern as the proposal tab. Previous version kept.
- Signature block and document downloads stay as they are.

### Invoice schedule you control

Before generating the SOW/invoices, the Invoices tab shows a schedule builder:

- **First invoice percentage** — default 30%, editable.
- **Remaining balance split into** — 1, 2, 3, 4, 5, 6, 9 or 12 installments (default 3).
- Live preview table: invoice number, amount, due date, send trigger. Rounding lands on the final installment so the rows always sum to the total.
- **Suggest schedule with AI** — proposes the split from project size, duration and the client's budget band, and fills the two controls above; you can override before saving.
- The saved schedule drives the invoices created at countersignature, replacing the fixed $600 installment default.

## Technical notes

- `buildPaymentPlan` in `src/lib/documents/compose.ts` gains a `percentage` plan kind taking `{ firstPercent, installments }`; existing kinds stay for older records.
- New `draftAgreement` server function in `src/lib/engagement.functions.ts` mirroring `draftEstimate`, calling the shared AI layer with provider/model from the picker; content stored on the agreement draft and composed into the SOW document.
- New `suggestInvoiceSchedule` server function returning `{ firstPercent, installments, rationale }`; clamped server-side to the allowed installment values.
- `AdminEngagementPanel.tsx`: SOW block moves out from under the `tab === "estimate"` container and gains its own actions; new schedule builder block under `tab === "invoices"`.
- Client-facing `EngagementPanel.tsx` shows the resulting schedule read-only.
- Unit tests: percentage plan math (rounding, all installment options) and schedule-suggestion clamping.
