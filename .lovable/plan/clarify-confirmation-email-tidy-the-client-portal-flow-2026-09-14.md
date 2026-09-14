# Clarify confirmation email + tidy the client portal flow

## 1. Name the confirmation email sender

Update the post-sign-up "Check your email" message in `src/routes/auth.tsx` so clients know the confirmation email comes from Supabase Auth:

> We sent a Supabase Auth confirmation link to **{email}**. Look for an email from Supabase Auth, confirm your address, then come back and sign in. The link can only be used once and expires, so request a fresh one if it stops working.

Same wording cue on the "Resend confirmation email" helper text.

## 2. Portal: projects first, details inside the project

Invoices stay behind sign-in — nothing changes about access; a client only sees their own invoices while signed in to the portal.

What changes is where they appear:

- **Portal home (`/portal`)** becomes a clean project queue: one card per project with its name, status and a short billing line (outstanding amount / paid in full / no invoices yet). The per-project expandable invoice list and inline Pay buttons are removed from this page so it reads as a queue, not a billing screen.
- **Clicking a project** opens `/portal/quotes/$id`, where the client sees the tabs — Overview, Proposal, Estimate, **SOW**, **Milestones**, **Invoices** — with Invoices holding the full billing table and Pay buttons that already exist there.
- Pay links from inside a project return the client to that project rather than the portal home, so they land back where they were.

## Technical notes

- `src/routes/auth.tsx` — copy change only in the `SignUpForm` done state.
- `src/routes/_authenticated/portal/index.tsx` — drop the `<details>` invoice list and inline Pay buttons; keep the billing summary line, account totals and "Open project" link. `listMyQuotes` keeps returning billing rollups (used for the summary line); the per-quote `invoices` map is no longer rendered here.
- `src/routes/_authenticated/portal/quotes/$id.tsx` — tab set is already Overview / Proposal / Estimate / SOW / Milestones / Invoices; no structural change needed beyond confirming SOW and Milestones show for every project (today the direct-billed case hides Proposal/Estimate/SOW — keep Milestones and Invoices visible there).
- Pay links inside `EngagementPanel` pass `return` as `/portal/quotes/{id}`.
- No schema, server-function or access-control changes.

## Verification

- `npx tsgo --noEmit`.
- Sign in as a client: portal home lists projects only; opening one shows SOW, Milestones and Invoices tabs with the invoices and Pay buttons.
