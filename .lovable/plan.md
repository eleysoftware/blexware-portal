# Fix the SOW tab: separate drafting, generating and sending — and format invoices

## What's wrong today

- The AI button is labelled "Draft scope with AI" and only writes a *scope addendum* into a markdown box. It never creates a SOW, so the status correctly stays "Not created" — the label just implies otherwise.
- There is one button, "Generate & send SOW", which creates the agreement, renders the PDF/DOCX and emails the client in a single irreversible step.
- The SOW tab shows raw markdown in a textarea. The formatted letter layout (which already exists and is used for proposals) is never displayed on this tab.
- Invoices are not documents at all: they are database rows plus an email and a pay link. There is no invoice PDF or Word file anywhere.

## 1. "Draft SOW with AI"

- Rename the button to **Draft SOW with AI**.
- It drafts the full SOW body — Scope of Work, Deliverables, Timeline, Client Responsibilities, Assumptions & Exclusions — not just an addendum, seeded from the approved proposal and estimate line items. Pricing, dates and payment terms still come from the approved estimate; the AI never invents them.
- The result lands in the editable text area, clearly labelled a draft for human review. Nothing is created or sent yet, and the status stays **Not created** — with a hint line: "Drafted. Press Generate SOW to create the document."

## 2. Generate and Send become two separate actions

- **Generate SOW** — creates (or updates) the agreement record, renders the formatted PDF and Word file, and sets the status to **Draft**. No email goes out. Pressing it again on a draft re-renders it, so you can iterate on the wording.
- **Send SOW for signature** — enabled only once a draft exists. Emails the client the signature link and moves the status to **Sent for signature**. This is the point of no return; after this, editing requires the existing "Revise the statement of work" checkbox.
- The revise flow keeps its current guardrails: revising voids the previous SOW, is blocked when live invoices exist, and produces a new version in the version list.

## 3. The SOW is shown formatted

- Once generated, the SOW tab shows the same formatted document preview used for the proposal (navy headings, party blocks, tables, payment schedule, acceptance and countersignature blocks), plus PDF and Word download buttons.
- The markdown box moves behind an "Edit SOW text" disclosure, matching the proposal tab.

## 4. Invoices become real documents

Yes — invoices are currently plain text. This plan gives them the same treatment:

- Each invoice renders a formatted invoice document: BLEXware header, bill-to block, invoice number, issue and due dates, line description tied to the payment schedule ("Payment 2 of 4"), amount due, amount paid, balance, and payment instructions with the pay link.
- The PDF and Word file are stored alongside the proposal/estimate/SOW documents, previewable and downloadable from the Invoices tab (admin) and the client portal.
- The invoice email links to the same document; the pay page shows the formatted invoice above the payment method chooser.

## Technical notes

- `src/lib/engagement.functions.ts`: split `createAgreement` into `generateAgreement` (create/update agreement row, `buildSowDoc`, `storeDocument`, status stays `draft`, audit `agreement.generated`) and `sendAgreement` (requires a `draft` agreement, sends `emailAgreementSent`, sets `sent`/`sent_at`, audit `agreement.sent`). The revise guard and void logic move into `generateAgreement`.
- `draftSowScopeWithAi` becomes `draftSowWithAi` with a fuller system prompt and a Timeline section; return shape unchanged.
- `src/lib/documents/compose.ts`: new `buildInvoiceDoc(agreementDoc, invoice, quote)` returning a `ProjectDocument` with `kind: "invoice"`; extend the `kind` union in `src/lib/documents/types.ts` and let `DocumentPreview` title the acceptance-free footer accordingly.
- `src/lib/invoicing.server.ts`: on invoice creation and on send, call `storeDocument({ entity: "invoice", kind: "invoice" })`. Requires no schema change if `documents.entity` is a text column — if it is a constrained enum, a small migration adds `invoice`.
- `src/components/admin/AdminEngagementPanel.tsx`: two SOW buttons, `DocumentPreview` + `DocumentDownloads` for `agreement.doc`, markdown behind `<details>`, invoice preview/downloads in the invoices tab. `src/components/EngagementPanel.tsx` and `src/routes/invoice.$token.tsx` get the client-side invoice preview.
- Tests: unit coverage for `buildInvoiceDoc` totals/balance and for the generate-then-send state machine (send blocked with no draft, generate blocked on a sent SOW without `revise`).
