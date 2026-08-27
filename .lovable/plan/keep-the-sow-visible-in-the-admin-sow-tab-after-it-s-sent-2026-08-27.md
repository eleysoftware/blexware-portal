# Keep the SOW visible in the admin SOW tab after it's sent

## What's wrong today

In `src/components/admin/AdminEngagementPanel.tsx` (line 848), the entire "Statement of work" card is gated on:

```text
tab === "sow" && sowEstimate && (!agreement || agreement.status === "draft" || sowReviseMode)
```

So the moment the SOW is sent for signature (status `sent`, later `signed`), the card — including the formatted `DocumentPreview` and the PDF/Word download buttons — vanishes from the tab. Only the version list and the signature/countersign card remain. The client portal still shows the document, but the admin can't read or download the very document they just sent.

## The fix: one SOW card, two modes

Restructure the SOW section so the card always renders when `sowEstimate` exists, and the editing controls are what gets gated:

- **View mode (SOW sent / signed / locked):** the card shows the status badge, the "Based on estimate v… approved…" line, the formatted `DocumentPreview` of `agreement.doc`, the PDF/Word download buttons, and the existing "Revise the statement of work" checkbox. No AI button, no markdown editor, no Generate/Send buttons.
- **Edit mode (no agreement yet, agreement is a draft, or revise mode ticked):** exactly what renders today — "Draft SOW with AI" + model picker, markdown textarea behind the "Edit SOW content" disclosure, and the Generate / Send buttons.

In edit mode the preview stays visible above the editor as it does now, so drafting → regenerate keeps its current loop.

## Small refinements

- Move the "Revise the statement of work" checkbox into the SOW card itself (it currently lives in the signature card below), so the lock/unlock control sits next to the document it unlocks. Keep its copy and guardrails unchanged (voids current SOW, blocked while live invoices exist).
- The document preview/downloads in view mode use the already-loaded `agreement.doc` and the existing `openDoc` helper — no new data fetching.
- Empty state (no approved estimate yet) is unchanged.

## Technical notes

- Single-file change: `src/components/admin/AdminEngagementPanel.tsx`.
- Change the line-848 condition to `tab === "sow" && sowEstimate` and introduce a `sowEditable = !agreement || agreement.status === "draft" || sowReviseMode` boolean; wrap the AI row, the markdown `<details>`/textarea, and the Generate/Send button row in `{sowEditable ? … : null}`.
- When `!sowEditable`, keep `DocumentPreview` + download buttons rendered; hide the "Edit SOW content" disclosure.
- Relocate the revise-checkbox block from the signature card (lines 1012–1030) into the SOW card's view mode; remove the old copy.
- No server, schema, or client-portal changes — this is admin presentation only.
- Regression check: SOW tab with a sent agreement shows preview + downloads + revise checkbox; ticking revise reveals the editor and the "Void & generate revised SOW" button; a draft agreement still shows the full editor with Send enabled.
