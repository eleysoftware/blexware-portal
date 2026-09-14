# Fix duplicate projects from a split invoice-only bill

## What you saw

Billing Las Vegas Mattress N Furn once, split into several payments, left a separate project for each payment instead of one project with several invoices.

## Diagnosis (not yet confirmed)

The current invoice-only code creates exactly one project and then attaches all the split payments to it, so today's code should not produce one project per payment. That means either these records were created before that behaviour existed, or something else on the way in created extra projects. So the first step is to look at the actual Las Vegas Mattress N Furn records and confirm the cause before changing anything — no fix will be applied to the creation flow until the records say what happened.

## Steps

1. **Look at the real records.** Pull the projects and invoices for that client and check how many projects exist, how many invoices sit under each, when each was created, and whether they were created in one action or several. Report what it shows.
2. **Fix the cause, if the records point to one.** If the records show the split path creating extra projects, correct it so one bill always produces one project. If they show the projects were created one at a time (or predate the current flow), say so plainly and skip this step rather than changing working code.
3. **Add a merge action.** On a project page in the team area, an admin action "Move invoices to another project" that lists the same client's other projects, moves the selected project's invoices across (renumbering their payment order to continue after the existing ones), and leaves the now-empty project ready to archive and delete with the existing confirmation dialog. Every move is written to the audit trail.
4. **Clean up Las Vegas Mattress N Furn.** Use the new action to consolidate their invoices under one project, then archive and delete the empty leftovers.
5. **Prevent a repeat.** On the new-invoice form, once a known client email is entered and that client already has projects, pre-select their most recent project instead of leaving "Create a new project" as the default, and show a short note explaining the choice.

## Technical notes

- Investigation: read-only queries against `quotes`, `invoices`, and `audit_log` (`invoice.created_direct` entries record how many invoices each action created, which distinguishes one split action from several separate ones).
- Merge: new admin-guarded server function in `src/lib/direct-invoice.functions.ts` that re-points `invoices.quote_id` and re-sequences, refusing to move invoices belonging to a signed SOW or tied to an agreement.
- UI: merge dialog next to the existing delete/archive controls on `src/routes/_authenticated/admin/quotes/$id.tsx`; default-project selection in `src/routes/_authenticated/admin/invoices/new.tsx`.
- No schema changes.
