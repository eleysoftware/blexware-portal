# Portal sign-in / sign-up on the client proposal page

Today a client who opens their proposal review link sees the document and the Approve / Request changes / Decline buttons, and nothing else. There's no way from that page to get into the portal where their project, milestones and invoices live.

## What changes

A short card is added under the response buttons on the proposal page:

- **Not signed in:** "Track this project in your BLEXware portal" with a line explaining they can follow the project, see milestones and pay invoices there, plus two buttons — **Sign in** and **Create account**, both going to the existing sign-in page (Create account opens it on the sign-up tab).
- **Signed in:** the same card instead shows **Open this project in your portal**, a direct link to the project page, so they don't lose their place.
- A one-line reminder to use the same email address the proposal was sent to, since the portal matches projects by email.

The review link keeps working exactly as it does now for clients who never sign up — signing in is offered, never required, and it is not shown once they've already responded... it stays visible either way so they can still follow the work.

## Technical notes

- `src/routes/proposal.$token.tsx` gains a `PortalAccessCard` rendered at the bottom of the response block, and the page keeps its current public/SSR behaviour (the card resolves the session client-side, so nothing is gated during prerender).
- Session state comes from `supabase.auth.getSession()` inside a `useQuery` in a client-only section (same approach as the staff strip on `invoice.$token.tsx`), so the public route isn't made auth-dependent.
- To link "Open this project in your portal", `getProposalByToken` (`src/lib/proposals.functions.ts`) adds `id: quote.id` to the returned `quote` object — currently only number/name/projectType are returned. No other server change.
- `/auth` gains an optional `tab` search param (`signin` | `signup`) so "Create account" lands on the sign-up tab; the existing default stays `signin`.
- No schema change, no email change, no change to the approve/decline flow.
