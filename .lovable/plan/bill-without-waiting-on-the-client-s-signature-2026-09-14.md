# Bill without waiting on the client's signature

## The problem

Right now the invoice schedule only exists after a chain of events: the SOW is sent, the client signs it in the portal, and only then can you set the start date and countersign — which is the step that actually creates the invoices. If the client signs on paper, by email, or not at all, the SOW tab keeps saying the client has not signed and there is no way forward, so no invoices can be generated or sent.

## What changes

### 1. Record the signature yourself

On the SOW tab, when an agreement is drafted or sent but not signed, add a **Record signature received** action. It opens a short confirmation asking:

- who signed (name, pre-filled with the client contact name)
- the date it was signed
- how it was received — on paper, by email, verbally, or waived

Confirming marks the SOW as signed on the client's behalf, stamps the signer's name and date, and notes in the document and in the activity log that the signature was recorded by staff rather than typed in the portal. The client is not emailed.

### 2. Waive the signature entirely

The same dialog offers **Waive — bill without a signature** for jobs that never had a SOW signing step. The SOW is marked signed-by-waiver, again logged as a staff action with who did it and when, and the countersignature block reads "Signature waived by BLEXware" instead of a client signature.

Either way, you land in the normal place: set the project start date, press **Approve & countersign**, and the invoice schedule is created exactly as it is today.

### 3. Say so honestly on the document

A SOW that was recorded or waived shows that plainly in its signature block — "Signature recorded by BLEXware staff (received on paper, 14 Sep 2026)" or "Signature waived" — on screen, in the PDF and Word copies, and in the client portal. Nothing is presented as an electronic signature the client did not make.

### 4. Guard rails

- Admin only.
- Confirmation names the agreement number and the client before it goes through.
- Every recording and waiver is written to the activity log with the admin's name, the reason, and the date given.
- A SOW the client already signed cannot be overwritten this way.

## Still open from the earlier request

The copyable-link piece you asked for before is not lost: once this is in, review, approval and signing emails all get their link shown as plain text under the button, and the estimate, SOW and completion rows each get a **Copy link** action next to the invoice pay link that already exists. I will fold that in after the bypass unless you want it first.

## Technical notes

- New admin server fn `recordAgreementSignature` in `src/lib/engagement.functions.ts`: `{ agreementId, mode: "recorded" | "waived", signerName?, signedOn?, channel? }`. Requires `requireAdmin`, rejects agreements already in `signed`/`void`, accepts `draft` and `sent`. Sets `status: "signed"`, `signed_at`, `signer_name`, and writes `signer_user_agent: "recorded-by-staff"` plus an `acceptance.clientSignature.recordedBy` block into `doc`. Audit action `agreement.signature_recorded` with mode, channel and actor.
- No schema change — existing `agreements` columns cover it.
- `SignatureBlock.tsx` renders the recorded/waived variant; `compose.ts` + `render.server.ts` carry the same wording into the PDF/DOCX acceptance block.
- `AdminEngagementPanel.tsx`: new dialog + button in the SOW card shown when `agreement.status === "draft" || "sent"`, invalidating `["engagement"]` so the existing start-date/countersign block appears immediately.
- `approveProjectStart` is unchanged; it still requires `signed`, which the new action satisfies.
- Test: `recordAgreementSignature` rejects an already-signed agreement, sets signed state for both modes, and `createInvoiceSchedule` then produces the expected invoice rows.
