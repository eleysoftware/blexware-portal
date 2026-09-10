# Remove payment schedule from invoice page

The project payment schedule now lives on the portal quotes page, so the invoice page should stop duplicating it. This keeps the invoice page focused on the current invoice and payment action.

## Change

In `src/routes/invoice.$token.tsx`, remove the `project && project.installments.length > 1` block that renders:

- "Project payment schedule" heading
- Project total / Paid to date / Remaining summary
- The ordered list of every installment with status and scheduled/due dates

This block currently starts around line 237 and ends around line 259.

## Preserve

- The invoice-level summary (Amount due, Billed to, Installment, Issued, Due, Invoice total, Amount paid, Description).
- The full-balance payment option (`canPayInFull` / `scope` radio buttons), which still needs `project.balanceCents` and `project.installments.length` as data.
- The back link to the portal project (`BackToProject`) and the post-payment "Return to your project" link.
- The `project` data fetch and the `data-testid="project-balance"` attribute is only on the removed schedule section, so no other references need updating.

## Verify

- Typecheck passes (`bunx tsgo --noEmit`).
- Invoice page still renders for paid, due, and inactive invoices.
- Payment amount selection (installment vs. full balance) still works when multiple installments remain.
