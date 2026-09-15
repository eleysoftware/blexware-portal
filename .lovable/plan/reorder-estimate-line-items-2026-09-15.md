# Reorder estimate line items

Give the cost & schedule estimate the same ordering controls the project phases now have, so the line items read in the order the work actually happens.

## What changes

On the Estimate tab of a project (team side), each line item row gains:

- **Up / down arrows** to move that item one place, disabled at the top and bottom.
- **Drag and drop** — pick a row up and drop it where it belongs; the arrows stay for keyboard and screen-reader use, so ordering never depends on dragging.
- Existing name, amount, duration and Remove controls stay exactly as they are.

The same controls appear on the import form's estimate line items, so an imported proposal can be put in order before the project is created.

Ordering is part of the estimate draft — nothing is saved until you save or generate the estimate, and the order you set is the order shown in the estimate preview, PDF, DOCX and the invoice schedule suggestion.

When the estimate is approved and locked, the reorder controls are disabled along with the rest of the fields, and come back when "Revise the approved estimate" is ticked.

## Technical notes

- Reuse the existing `moveItem` / `nudgeItem` helpers in `src/lib/reorder.ts`.
- `src/components/admin/AdminEngagementPanel.tsx`: the `rows` state (`Draft[]`) drives the list; add arrow buttons and `draggable` row handlers calling `setRows(moveItem(rows, from, to))`. Rows currently key on `index` — switch to a stable per-row id so drag reordering does not confuse React's reconciliation of the inputs.
- `src/routes/_authenticated/admin/import.tsx`: same treatment for its `LineRow[]` state.
- No server or schema change — `lineItems()` already maps `rows` in order and downstream composition (`src/lib/documents/compose.ts`) preserves that array order.
- The locked-estimate `fieldset disabled` already covers `<button>` elements, so the new controls disable automatically.
