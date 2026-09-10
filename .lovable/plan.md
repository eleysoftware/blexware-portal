# Client portal: projects and billing organized by client email

Everything a signed-in client sees is already keyed to their verified email address. This plan makes that organization visible and adds a real billing view: a list of projects, and under each project a billing section with every invoice — paid, sent, and upcoming — that can be paid without hunting for an emailed link.

## What the client will see

**Portal home — "Your projects"**
- Signed in as their email, with a short account summary line: total paid to date and total currently outstanding across all projects.
- Each project card gains a billing line: amount outstanding (or "Paid in full" / "No invoices yet") and a count of invoices awaiting payment, with an "action needed" highlight when something is due.

**Project page — Billing section**
- The existing Invoices tab becomes a full billing view for that project:
  - Project total, paid to date, remaining balance.
  - One table of every invoice visible to the client: number, installment, issue/due date, amount, amount paid, status badge (Paid, Awaiting payment, Overdue, Upcoming/Scheduled, Cancelled).
  - Overdue and awaiting-payment invoices sort to the top.
  - Each row: download PDF/DOCX (existing document links) and, when payable, a "Pay" button that opens the existing payment page for that invoice, where card/ACH and the pay-in-full option already live.
  - Paid rows show the payment date and method, plus a receipt download when one exists.
- Upcoming installments are clearly labeled as not yet payable, so the schedule is visible without implying money is due.

## Access rules

No change to who can see what. Reads continue through the client's own database session, which already restricts every quote, estimate, agreement, invoice, document and payment to rows whose contact email matches the signed-in verified email. Exact-email matching only — no linking of alternate addresses.

## Technical notes

- `src/lib/portal.functions.ts` — `listMyQuotes` returns a per-quote billing rollup (total billed, paid, outstanding, count of payable invoices) plus an account-level total. Aggregation done server-side over invoices the caller's RLS session can read; scheduled/void rows excluded from "outstanding".
- `src/lib/client-engagement.functions.ts` — `getMyEngagement` invoice select extended with `issue_date`, `amount_paid_cents`, `currency`, `description`, `viewed_at`, and a matching `invoice_payments` read (already client-readable) so paid rows can show date and method. Add a project payment summary to the return value, mirroring the shape used on the public invoice page.
- `src/components/EngagementPanel.tsx` — replace the current flat invoice list with the billing section described above; keep `DownloadRow` for per-invoice documents; Pay button links to `/invoice/$pay_token` as today.
- `src/routes/_authenticated/portal/index.tsx` — account summary header and per-card billing line.
- Reuse `formatMoney` and existing status/badge conventions; no new color values.
- No schema migration and no payment-logic changes.

## Out of scope

- Inline checkout inside the portal (payment still opens the existing payment page).
- Multi-email/company account linking.
- Admin-side changes.
