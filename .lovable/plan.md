# Import upgrades + project Milestones board

Three changes: a real upload button at the top of the Import page, cost/schedule pulled out of the uploaded proposal into the Estimate, and a new Milestones (Kanban) tab on every project.

## 1. Upload button at the top of Import

- Move the upload control to the very first card on "Import an existing project", above "Start from a saved project".
- Replace the bare file input with a clear primary button: "Upload a proposal you already sent (PDF or Word)". The file picker opens from the button; the file name shows next to it once chosen.
- Short helper line: PDF, Word (.docx), markdown or text, up to 10 MB; it prefills everything below for review.
- While reading, the button shows "Reading the document…" and is disabled.
- The "Proposal content" card keeps the editable text area and document title, minus the upload input.

## 2. Pull cost and schedule out of the uploaded proposal

Today the upload only fills in proposal text and the client fields. It will also fill in the estimate.

- Extend the document reader so it also returns, when the document clearly states them: line items (label, amount, optional duration), a discount and its label, an overall duration summary, and the detected phases.
- When line items come back, the Import page automatically switches the starting stage to "Estimate draft" (unless a later estimate stage is already selected) so the estimate section is visible, fills the line-item rows, discount and duration summary, and shows a note: "Cost and schedule details were read from the document — check the amounts before importing."
- Everything stays editable; nothing is saved until "Import project" is pressed.
- If no pricing is found, behaviour is unchanged.

## 3. Milestones tab (Kanban)

- New "Milestones" tab in both the admin project workspace and the client project page, between SOW and Invoices.
- Four swim lanes: Not started, In progress, Testing, Done.
- Admin: add, rename, reorder and move milestones between lanes (drag and drop, plus a lane selector for keyboard and touch access). Each milestone has a title, optional note and optional target duration.
- Client: same board, read-only, so they can see progress at a glance.
- Project page header/overview shows a compact progress line (e.g. "3 of 7 milestones done").
- On import, every phase detected in the proposal is created as a milestone in "Not started", in document order. Estimate line items that look like phases are used when the document has no explicit phase list.

## Technical notes

- New table `public.project_milestones` (quote_id, title, note, lane, position, target_duration, timestamps) with grants, RLS: admins/staff full access; clients read-only for projects on their verified email. Added as `supabase/schema/010_project_milestones.sql` and applied as a migration.
- `extractProposalFromFile` in `src/lib/import.functions.ts`: extend the AI JSON contract with `lineItems`, `discountCents`, `discountLabel`, `durationNote`, `phases`; keep the raw-text fallback when AI is unavailable.
- `importProject`: accept `phases` and insert milestones after the quote row.
- New `src/lib/milestones.functions.ts` (list/create/update/move/delete, admin-guarded writes; list reachable by the owning client) and `src/components/MilestoneBoard.tsx` with a `readOnly` prop, reused by both workspaces.
- `src/lib/workflow-guidance.ts` gains a purpose string for the `milestones` tab.
- Unit tests for phase/line-item extraction parsing and lane reordering.
