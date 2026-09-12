# Upload help + delete a project

Two additions to the team area: an explainer for the proposal upload, and a proper delete-with-confirmation for a project.

## 1. Help for uploading a proposal

On the Import Existing Project page, next to the upload button, add a "How this works" help button that opens a short panel explaining:

- Which files work: PDF, Word (.docx), Markdown, plain text, up to 10 MB. Old `.doc` files and scanned/photo-only PDFs can't be read — save as PDF/Word text or paste the text instead.
- What gets filled in automatically: client name and email, company, project title, the proposal text, the priced line items with durations, any discount, the overall duration note, and the project phases.
- Where each part lands: pricing goes to the Cost & schedule estimate section, phases go to the Milestones board as "Not started".
- That everything is a draft for review — nothing is sent to the client until it is imported and sent.
- What to do if something is missing: fix it directly in the fields below, or re-upload a cleaner file.

The same short version appears as a one-line hint under the upload button so the purpose is clear without opening help.

## 2. Delete a project (with confirmation)

Today deleting only happens from the archived list and uses plain browser pop-ups. Replace with a consistent, styled confirmation:

- A "Delete project" action on the project page itself (the page you are on now) and on the project list row.
- The confirmation dialog names the project and client, lists what will be removed (proposal, estimate, SOW, invoices, documents, uploaded files, milestones), and requires typing the project number to enable the Delete button.
- Projects with a signed SOW or issued invoices still cannot be deleted; the dialog says so up front and offers Archive instead.
- Archiving keeps its own lighter confirmation dialog (reversible, no typing).
- After deleting from the project page, return to the project list with a confirmation message.

## Technical notes

- New `src/components/ProposalUploadHelp.tsx` (shadcn `Dialog`), used in `src/routes/_authenticated/admin/import.tsx` beside the top upload button.
- New `src/components/DeleteProjectDialog.tsx` (shadcn `AlertDialog` + typed-confirmation `Input`), replacing the `window.confirm`/`window.prompt` calls in `src/routes/_authenticated/admin/index.tsx` and added to the quote workspace page.
- Server side unchanged: keep `archiveQuote` and `deleteQuotePermanently` in `src/lib/admin.functions.ts`, including the archive-before-delete rule and the signed-SOW / issued-invoice guards; the dialog surfaces those rules in plain language and calls archive-then-delete in one flow when the project isn't archived yet.
