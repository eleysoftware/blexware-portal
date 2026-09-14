# Team queue: show invoices nested under each project

## What's happening now

On the team queue, expanding a client shows a flat table with one row per project. Each row is a project, but invoices are not shown at all — only an "Outstanding" total. When a client has several one-off invoices that were each created as their own small project, the list reads like a list of invoices rather than one project with its invoices underneath.

The client-facing portal already does the right thing: it shows one card per project with the invoice rows listed under it, and hides empty placeholder projects. No change is needed there.

## What will change (team queue only)

Expanding a client shows each project as a group header with its invoices indented beneath it:

- Project line: quote number, project name, status, outstanding amount, date, and the existing Archive / Restore / Delete actions.
- Under it, one line per invoice: invoice number, amount, amount paid, status, issue and due dates, and a link that opens the invoice.
- Projects with no invoices say "No invoices yet" instead of an empty block.
- Clicking the project still opens the full project workspace.

## Sorting out duplicate projects

Separate one-off invoices that were each given their own project stay separate records — the plan does not merge them automatically, since merging billing history is risky. Two supporting changes:

- When creating a new invoice, the client's existing projects are already offered; that picker stays and gets a clearer hint that picking an existing project keeps everything in one place.
- Empty projects (no invoices, no proposal) are collapsed into a single "Unused project shells" line per client with an archive action, so the list stops looking like duplicates.

If you'd rather the older duplicates be merged into one project, say so and that becomes a follow-up step.

## Technical notes

- `listQuotes` in `src/lib/admin.functions.ts` already fetches invoice rows for the billing rollup. Extend that query to return the rows themselves (`id, quote_id, invoice_number, amount_cents, amount_paid_cents, status, issue_date, due_date, pay_token, sequence`) as `invoicesByQuote`, keeping the existing `billing` totals. Drop the `draft` exclusion for the listing copy so drafts appear with a Draft badge, while the outstanding rollup keeps excluding void/cancelled/draft.
- `src/routes/_authenticated/admin/index.tsx`: replace the flat `<table>` inside the expanded client block with a per-project section — project header row plus a nested invoice list, mirroring the markup conventions used in `src/routes/_authenticated/portal/index.tsx`. Keep `DeleteProjectDialog`, archive toggle, search auto-expand, and archived-filter behaviour unchanged.
- Empty-shell grouping uses the same test the portal applies (no invoices and no proposal); `listQuotes` returns a `hasProposal` flag per quote so the UI can apply it without another round trip.
- No schema or server-function contract changes beyond the added `invoicesByQuote` field; the portal and all payment flows are untouched.

## New invoice form: say why it won't submit

Submitting the new invoice form with a required field missing gave no feedback — the buttons simply did nothing. The form will now:

- List exactly what is still needed above the buttons (client name, valid email, invoice description, at least one priced line, payments that add up to the total).
- Mark the specific fields that are missing once you've tried to submit.
- Show a clear message if the server still rejects the invoice, instead of failing silently.

Technically: `src/routes/_authenticated/admin/invoices/new.tsx` computes a `missing` list used both for the summary message and per-field error text, and the submit handler surfaces server errors through a toast.
