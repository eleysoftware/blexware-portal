# Quote → Proposal → SOW → Invoices (with Stripe)

Extends the existing quote pipeline into a full engagement workflow, using your Build Financial Wellness proposal as the document template, and seeds Tamara West's project as a live record.

## The flow

```text
Quote submitted
  → Proposal drafted (AI or manual) → sent to client
      → client requests changes (note) → admin regenerates/edits → resend
      → client approves  |  client declines (optional reason → thank-you email)
      → no response in 5 days → auto-declined (reminder at day 3)
  → Admin adds cost + time estimates (line items, discounts, phases, schedule)
      → Estimated proposal sent → client approves / declines (optional reason)
  → Admin converts to SOW Agreement → client e-signs (typed name + consent)
  → Invoice schedule generated: $600 installments, remainder added to invoice #1
      → Invoice 1 sent immediately; work starts after invoice 1 is paid
      → Remaining invoices auto-send every 14 days (admin can pause / edit / send early)
      → Client pays online via Stripe Checkout; receipt email on payment
```

## Documents

- One template renderer produces the proposal, estimated proposal, and SOW agreement from stored structured data (client block, executive summary, objectives, phases with features, pricing table with discounts/credits, schedule table, payment terms, exclusions, acceptance block) — matching the layout, section order, and footer of your Build Financial Wellness proposal, in BLEXware brand colors.
- Download as **PDF** and **DOCX** from both admin and the client portal. Signed SOWs are rendered once with the signature block filled (name, date, IP, timestamp) and stored immutably in Supabase Storage.

## E-signature

Client types their full legal name, checks a consent statement, and submits. We store signature name, signed timestamp, IP, user agent, and a hash of the signed document. The signed PDF is locked and downloadable by both sides; an audit entry and confirmation email are recorded.

## Stripe (your own account)

You connect your own Stripe account with your secret key. Each invoice creates a Stripe Checkout session; a webhook marks the invoice paid, records the payment, emails a receipt, and (for invoice #1) flips the project to "work authorized". Note: Lovable's built-in payments would need no key setup — happy to switch if you change your mind.

## Real client seed

Build Financial Wellness is created as a live quote with the proposal content, the seven phases, the $1,300 subtotal / 20% loyalty discount / $1,040 total, the phase timeline table, and the exclusions list already entered — positioned at the estimated-proposal stage so Tamara logs in, approves, signs the SOW, and receives invoices ($600 + $440 → remainder folded into invoice #1 = $640 / $400 per your rule; exact split confirmed with you before sending).

## Technical notes

- New tables: `proposal_versions` (content + revision requests), `estimates` (line items, totals, discounts, schedule), `agreements` (SOW, signature fields, document hashes), `invoices` (number, amount, due date, status, stripe session/payment ids), `payments`. All with grants + RLS: admins full access via `has_role`, clients read/act only on rows matching `viewer_email()`.
- Server functions in `src/lib/` for each transition; state machine guards illegal transitions. Client actions live under `_authenticated/portal`, admin under `_authenticated/admin`.
- Document generation server-side with Worker-safe pure-JS libraries (`docx` for DOCX, `pdf-lib` for PDF); files stored in a private `documents` bucket, delivered by short-lived signed URLs.
- Stripe webhook at `src/routes/api/public/stripe/webhook.ts` with signature verification; Checkout sessions created in an authenticated server function.
- Scheduled jobs (5-day proposal expiry, day-3 reminder, biweekly invoice send) run via a signed `/api/public/cron/*` endpoint triggered by pg_cron, with per-invoice pause flags respected.
- Emails continue through ZeptoMail from quote@blexware.com: proposal sent, changes requested, approval, decline thank-you, SOW ready to sign, signed copy, invoice due, receipt.
