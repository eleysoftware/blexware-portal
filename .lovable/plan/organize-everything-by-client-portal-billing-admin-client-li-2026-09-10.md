# Organize everything by client: portal billing + admin client list

Quotes, documents and invoices are already tied to the client's email address. This plan makes that grouping visible on both sides: clients get a project list with a real billing section, and the team gets a list of clients with their projects nested underneath.

## Client portal

**Portal home — "Your projects"**
- Account summary line: total paid to date and total currently outstanding across all projects.
- Each project card gains a billing line: amount outstanding (or "Paid in full" / "No invoices yet") and a count of invoices awaiting payment, highlighted when something is due.

**Project page — Billing section**
- The Invoices tab becomes a full billing view for that project:
  - Project total, paid to date, remaining balance.
  - One table of every invoice: number, installment, issue/due date, amount, amount paid, status (Paid, Awaiting payment, Overdue, Upcoming, Cancelled). Overdue and due-now sort to the top.
  - Per row: download PDF/DOCX, and a "Pay" button for payable invoices that opens the existing payment page.
  - Paid rows show the payment date and method, plus a receipt download when one exists.
  - Upcoming installments are labeled as not yet payable.

**Getting back from the payment page**
- The Pay button passes a return destination, and the payment page shows a "Back to your project" link at the top and again after a successful payment ("Return to your project" alongside the receipt).
- Only same-site portal destinations are accepted; visitors arriving from an emailed link with no destination see the existing page unchanged, plus a "Sign in to your portal" link.

## Admin

**Client list replaces the flat quote queue**
- `/admin` lists clients (grouped by contact email), each row showing name, company, email, number of projects, current outstanding balance, and the most recent activity date, sorted by most recent.
- Expanding a client (or opening the client page) shows their quotes/projects with status badge and outstanding balance; clicking one opens the existing quote workspace.
- Search box covers both: type a client name, company or email to filter clients; type a quote number to jump straight to that quote, opened under its client.
- Existing filters (status, Archived view) and row actions (archive, restore, delete) are preserved, applied within the client grouping.

## Access rules

Unchanged. Client reads run through the client's own database session, restricted to rows whose contact email matches their signed-in verified email — exact match only, no alternate-address linking. Admin reads stay staff-only.

## Technical notes

- `src/lib/portal.functions.ts` — `listMyQuotes` returns a per-quote billing rollup (billed, paid, outstanding, payable count) plus account totals, aggregated server-side over RLS-visible invoices; scheduled/void excluded from "outstanding".
- `src/lib/client-engagement.functions.ts` — extend the invoice select with `issue_date`, `amount_paid_cents`, `currency`, `description`, read the client-visible `invoice_payments` rows for date/method, and return a project payment summary matching the shape used on the public invoice page.
- `src/components/EngagementPanel.tsx` — replace the flat invoice list with the billing table; keep `DownloadRow`; Pay links to `/invoice/$pay_token` with a `return` search param.
- `src/routes/invoice.$token.tsx` — add validated `return` search param (must start with `/portal/`), rendered as back links before and after payment.
- `src/routes/_authenticated/portal/index.tsx` — account summary and per-card billing line.
- `src/lib/admin.functions.ts` — add `listClients` (aggregate quotes by lower(contact_email): latest name/company, project count, outstanding balance, last activity) and `getClientQuotes`. Keep `listQuotes` for quote-number search; existing `search` already matches number/name/email/company.
- `src/routes/_authenticated/admin/index.tsx` — client-grouped list, expandable projects, unified search with quote-number jump; new `src/routes/_authenticated/admin/clients/$email.tsx` if a dedicated client page reads better than inline expansion.
- Reuse `formatMoney` and existing badge conventions. No schema migration, no payment-logic changes.

## Out of scope

- Inline checkout inside the portal.
- Multi-email/company account linking.
- Changing the quote workspace itself.
