# Tidy up the quote admin + client portal

Both quote pages stack every card on top of each other, so the page runs very long. This reorganizes both around a stage carousel plus tabs, drops the raw markdown editor, and adds the BLEXware countersignature / start-date step.

## 1. Status carousel (admin)

Replace the 13-button status row with a single horizontal stage carousel:

```text
   Proposal sent   |   ▸ PROPOSAL APPROVED ◂   |   Estimate draft
     (faded)              (current, bold)           (faded)
```

- Current stage centered and emphasized; previous and next partially visible and faded at the edges.
- Arrow buttons and swipe move through stages; selecting a stage updates the quote status (same server call as today).
- Keyboard accessible (arrow keys, visible focus), with the status name announced to screen readers.
- The client portal keeps a read-only version of the same rail so the client sees where the project stands.

## 2. Tabs instead of stacked cards

Both pages get one card with tabs. Each tab only enables once that stage exists:

- **Intake** — the quote answers, services, goals, features, attachments.
- **Proposal** — formatted document preview, downloads, generate/regenerate, send, copy review link.
- **Estimate** — line items, discount, payment schedule, AI draft, send.
- **SOW** — agreement, signature status, countersign / start date, downloads.
- **Invoices** — invoice list, payments, refunds, offline payments (admin) / pay links (portal).
- **Activity** — audit trail (admin only).

The unformatted markdown editor is removed from the admin proposal tab; only the formatted document is shown. Editing wording is done by regenerating with a change request. (Say the word if you still want a raw-text escape hatch behind a "Advanced" toggle.)

## 3. Countersignature and project start date

New admin step after the client signs the SOW:

1. Client signs → status becomes "SOW signed", agreement shows "Awaiting BLEXware approval".
2. Admin opens the SOW tab, picks the **project start date**, and clicks **Approve & countersign**.
3. That action:
   - stamps the agreement with Kamal Eley's countersignature — printed name plus a cursive-script rendering of the signature, with the countersign date — into the stored PDF/DOCX and the on-screen preview;
   - records the start date on the agreement and writes it into the SOW acceptance block ("Work begins <start date>, contingent on payment of the first invoice");
   - issues invoice #1 with a due date set a few days before the start date, emails it to the client, and moves the quote to "Invoicing".
4. Remaining invoices continue on the existing schedule.

## Technical notes

- New UI: `StatusCarousel` component (built on the existing `ui/carousel`) and tabbed layouts using `ui/tabs` in `src/routes/_authenticated/admin/quotes/$id.tsx`, `src/routes/_authenticated/portal/quotes/$id.tsx`, `AdminEngagementPanel.tsx`, and `EngagementPanel.tsx`. Panels are split into per-tab sub-components so the files stay readable.
- Migration on `public.agreements`: `start_date date`, `countersigned_at timestamptz`, `countersigner_name text`, `countersigned_pdf_path text`. Existing grants/RLS unchanged.
- New authenticated admin server function `approveProjectStart({ agreementId, startDate })` in `src/lib/engagement.functions.ts` — verifies the admin role, requires the agreement to be signed, re-renders the countersigned document via `storeDocument`, sets the start date, then calls the existing invoice schedule/send path with the derived due date.
- `ProjectDocument.acceptance` gains a `countersign` block (name, title, date, script text). `render.server.ts` (PDF + DOCX), `DocumentPreview.tsx`, and `compose.ts` render it; the cursive line uses a script webfont in the preview and an embedded script font in the PDF.
- Invoice generation moves from "on client signature" to "on admin countersign" so the first invoice carries the correct due date. Client sign still records signature, hash, IP and notifies the team.
