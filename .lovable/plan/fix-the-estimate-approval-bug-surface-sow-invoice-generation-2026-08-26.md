# Fix the estimate-approval bug, surface SOW + invoice generation, finish the sandbox run

Your notes change the picture: the webhook is registered (payment settings' Webhook URL field is the right place in your Hyperswitch plan — no separate endpoint list needed), ACH is pending approval, and the real blocker is that the admin view loses the client's estimate approval.

## 1. Root cause of "Estimate approved" not showing in the Estimate tab

Confirmed in code, not a guess. When the client approves, `respondToEstimate` correctly sets that estimate row to `approved` and the quote to `estimate_approved` — which is why the stage rail is right.

But `saveEstimate` (the "Save draft" and "Send estimate to client" buttons) only updates the existing row when its status is `draft`. Once the row is `approved`, any later save **inserts a brand-new draft estimate row** and resets the quote to `estimate_draft`. The admin panel reads `estimates[0]` (newest first), so it now shows the new draft, the approved row is invisible, and "Generate & send SOW" — which renders only when `estimate.status === "approved"` — never appears.

Fixes:

- `saveEstimate` refuses to silently fork an approved estimate. Editing an approved estimate becomes an explicit "Revise estimate (creates a new version)" action, and it no longer downgrades the quote status behind your back.
- The Estimate tab lists estimate versions with their status, defaulting to the approved one when it exists, so "approved" is visible where you expect it.
- Any existing stray draft rows on Tamara West's quote get cleaned up so the approved estimate is the current one again.
- Admin fallback: an explicit "Mark estimate approved (recorded offline)" action with a required note, for when a client approves by email/phone. Audit-logged with who recorded it.

## 2. SOW generation, visible in the SOW tab

- The SOW tab owns the SOW lifecycle end to end, with a status line: "Waiting on an approved estimate" / "Ready to generate" / "Sent for signature" / "Signed — awaiting countersignature" / "Countersigned". Buttons are always visible, disabled with the reason shown, instead of vanishing.
- **Draft SOW with AI** plus the model picker: AI writes scope, deliverables, assumptions, exclusions, milestones, and acceptance criteria from the approved estimate and proposal. It lands in an editable field; nothing goes out until you press send. Drafts always require your review.
- Regenerate with a change request, same pattern as the proposal tab; previous version kept.
- Signature block and document downloads stay as they are.

## 3. Invoice schedule you control

A schedule builder in the Invoices tab, applied when the SOW is countersigned:

- **First invoice percentage** — default 30%, editable.
- **Split the balance into** — 1, 2, 3, 4, 5, 6, 9, or 12 installments (default 3).
- Live preview: invoice number, amount, due date, send trigger. Rounding lands on the last installment so rows always sum to the total.
- **Suggest schedule with AI** — proposes the first-invoice percentage and installment count from project size, duration, and the client's budget band, with a one-line rationale; you can override before saving.
- This replaces the fixed $600-installment default.

## 4. "Create project from existing proposal" (import tool)

Instead of a one-off Tamara West button, the admin queue gets a general **Create project from existing proposal** action for onboarding any engagement that started outside the portal:

- **Project name** for the imported engagement, plus client name, email, company, and phone.
- **Upload the existing proposal** — PDF or Word (.docx), up to 20 MB. The file is stored privately with the quote, its text is extracted, and it becomes the proposal content and the formatted proposal document. You can edit the parsed text before saving if the extraction is imperfect.
- **Starting stage** — pick where the project already is: Proposal sent, Proposal approved, Estimate draft, Estimate sent, Estimate approved, SOW sent, SOW signed, or Invoicing. The quote, proposal, and (where the stage requires it) estimate rows are created in states consistent with that choice, so the workspace tabs and stage rail line up immediately.
- Optional line items/total when the chosen stage is estimate-or-later; otherwise you price it in the Estimate tab afterwards.
- Everything is audit-logged as an admin import, and the client's portal access works the same as a normal quote.

Tamara West's Build Financial Wellness project is then created through this same tool (the existing hard-coded importer stays available as a preset), giving steps 5–6 below something to move through.


## 5. What's left for you (after the above ships)

1. Countersign: Admin → Tamara West's quote → SOW tab → set the start date → "Approve & countersign". Invoice 1 should appear, due three days before the start date.
2. Invoices tab → "Send now" on invoice 1, then open the pay link.
3. Pay with sandbox card `4242 4242 4242 4242`, any future expiry/CVC. Expect "Payment Successful" with invoice number, amount, method, date, reference, remaining balance; admin flips to paid and "Payout status" returns settlement detail.
4. ACH stays hidden until your connector approval lands — the invoice page already hides unavailable methods, so nothing breaks in the meantime. Ping me when it's approved and we'll run that path.

I can't run 1–3 myself: this project uses an external Supabase that Lovable can't mint an admin session for, so automated browser runs have no login. Paste any error text you see and I'll fix from there.

## Technical notes

- `saveEstimate` in `src/lib/engagement.functions.ts`: version-aware branch (`draft` → update; `approved`/`sent` → require an explicit `revise: true` flag), and no unconditional `quotes.status = 'estimate_draft'` write.
- New `markEstimateApproved` admin server fn (note required, audit-logged).
- New `draftAgreement` server fn mirroring `draftEstimate`, using the shared AI layer with the picker's provider/model; content stored on the agreement draft and composed into the SOW doc by `buildSowDoc`.
- New `suggestInvoiceSchedule` server fn returning `{ firstPercent, installments, rationale }`, clamped server-side to the allowed installment values.
- `buildPaymentPlan` in `src/lib/documents/compose.ts` gains a `percentage` kind taking `{ firstPercent, installments }`; existing kinds retained for older records.
- `AdminEngagementPanel.tsx`: SOW block moves out of the `tab === "estimate"` container into its own SOW section; new schedule builder under `tab === "invoices"`; estimate version list in the estimate section.
- New `importProject` admin server fn + `/admin/import` route: Zod-validated fields, PDF/DOCX upload into the existing private `quote-uploads` bucket, server-side text extraction (PDF via the existing renderer stack, DOCX via a mammoth-style extractor), then quote/proposal/estimate rows written in states derived from the chosen stage. `seedBuildFinancialWellness` is refactored to call the same core so there is one code path.
- Unit tests: percentage-plan math across every installment option, save-after-approval no longer forking, schedule-suggestion clamping, and stage → row-status mapping for the importer.
