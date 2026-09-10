# Direct invoicing: client → project → invoice (no quote/proposal/SOW)

Give the team a way to bill someone who never came through the quote form: add the client, name the project, list the services or products with prices, and send one invoice — optionally split into several payments that behave exactly like today's installments.

## What the team will see

A new **New invoice** button on the team dashboard opens a single page with four steps on one screen:

1. **Client** — pick an existing client (by email, from past projects) or type a new one: name, email, company, phone.
2. **Project** — short project name/type and an optional internal note. This creates the record everything hangs off, so the invoice shows up in that client's group on the dashboard and in the client's portal.
3. **Invoice** — a description shown on the invoice, an issue date and due date, and an itemized list of lines (description, quantity, unit price, line total). An optional discount line. Grand total calculates as you type.
4. **Payments** — pay in full, an even split (2–12), or custom amounts, reusing the same builder the SOW estimates use. The first invoice can be sent immediately; the rest are created as scheduled/manual and sent from the invoices tab as usual.

Then: **Save as draft** or **Create and send now**. Sending emails the client the same formatted invoice with the private pay link they already get today. The invoice appears in the client's portal billing view and can be paid by card (or ACH once enabled) like any other invoice.

Once created, the project opens in the normal workspace with only the invoicing area active — no proposal, estimate, or SOW tabs, since none exist.

## Behaviour rules

- Full-balance payment, partial payment, receipts, refunds, and the paid-in-full/completion sign-off flow all work unchanged, because these are ordinary invoice rows.
- The itemized lines are stored with the invoice and printed on the PDF/DOCX under the description.
- Splitting produces multiple invoices whose amounts always add back to the grand total (rounding drift on the first), same as the existing splitter.
- Only team accounts can reach the page; the client only ever sees the sent invoices.

## Technical notes

**Migration**
- `alter table public.invoices alter column agreement_id drop not null;` (standalone invoices have no agreement).
- Add to `public.invoices`: `line_items jsonb not null default '[]'::jsonb`, `subtotal_cents bigint not null default 0`, `discount_cents bigint not null default 0`.
- Mirror the SQL into `supabase/schema/009_standalone_invoices.sql` for out-of-Lovable environments.

**Server**
- New `src/lib/direct-invoice.functions.ts` (admin-gated via `requireSupabaseAuth` + `requireAdmin`, wrapped in `guarded`):
  - `listClients` — distinct contact email/name/company from `quotes` for the picker.
  - `createDirectInvoice` — inserts a `quotes` row (status `invoicing`, `consent: true`, `internal_notes` marked as direct-billed, budget/timeline "Not stated"), then invoice rows built from `buildPaymentPlan(...)` + `paymentPlanToInvoiceEntries(...)`, `sequence` starting at 1, `pay_token` and `invoice_number` as today. Optionally calls `dispatchInvoice` for the first row when "send now" is chosen. Writes an audit entry (`invoice.created_direct`).
- `renderInvoiceDocument` / `loadInvoiceByToken` already tolerate a null agreement; `getProjectPaymentSummary` needs a fallback that derives the plan from the invoice rows themselves when no agreement exists.
- `buildInvoiceDoc` gains an optional `lineItems` + `subtotal/discount` block rendered as a table above the amount due.

**UI**
- New route `src/routes/_authenticated/admin/invoices/new.tsx` following the layout conventions of `admin/import.tsx`; link it from the dashboard header next to "Import existing project".
- Line-item editor and split controls reuse the components/helpers already used in `AdminEngagementPanel` (`evenSplitRows`, `buildPaymentPlan`, custom amount rows) rather than new logic.
- `AdminEngagementPanel` / `EngagementPanel`: hide proposal, estimate, and SOW tabs when no proposal exists so a direct-billed project shows only invoices, and adjust `workflow-guidance` so the next step for such projects starts at invoicing.

**Tests**
- Unit tests for `createDirectInvoice` totals: itemized total = sum of lines − discount, split amounts sum to the grand total, sequence numbering, and that no agreement/proposal rows are created.
