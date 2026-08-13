# Breach-checked sign-up, client portal, and client role

Two connected pieces: a hardened sign-up path that checks passwords against Have I Been Pwned before an account is created, and a client-facing portal backed by a new `user` role so customers can see their own quotes and proposals.

## 1. Password strength + breach checking

**Client side (runs in the browser, instant feedback)**
- A reusable `PasswordField` with a live strength meter (`zxcvbn-ts`, lightweight and tree-shakeable).
- Hard rules enforced before submit: 12+ characters, uppercase, lowercase, number, symbol, and not obviously weak. Failures block submission with a specific message per rule, not one generic error.
- Rules live in a shared Zod schema so the server re-validates the exact same rules — client validation is UX, never the boundary.

**Server side (the actual security boundary)**
- A `signUpUser` server function does the breach check: SHA-1 the password with Web Crypto, split into a 5-char prefix and suffix, call `https://api.pwnedpasswords.com/range/{prefix}` with the Add-Padding header, and compare suffixes locally. The plain password and full hash never leave the server.
- Any match rejects with: "This password has been found in a known data breach. Please choose a safer password."
- On pass, the service-role admin client calls `auth.admin.createUser()` with email confirmation required, then inserts the appropriate `user_roles` row.
- Rate limited per IP and per email to stop enumeration and HIBP abuse; failures log to `audit_log` without the password or email in plain metadata.

A note on the request: on this stack the correct home for this is a TanStack server function, not a Supabase Edge Function. It runs on the same origin (no CORS handling needed, no separate deploy), uses the same Web Crypto and service-role client, and gives identical security properties. Everything in the request is preserved except the hosting location.

## 2. Covering Supabase's own password paths

The app-level check only covers sign-ups the app creates. Dashboard invites, password resets, and any future OAuth-less flows go through Supabase Auth directly. To cover those, we add a **Before User Created** auth hook plus a **Password Verification** hook pointed at a public HTTPS endpoint in this app:

- `POST /api/public/auth-hooks/password-check` — verifies the Supabase hook signing secret, runs the same HIBP range check, returns an error payload to reject the password.
- Configured in the Supabase dashboard under Authentication → Hooks, with the shared secret stored via the secrets tool.

Caveat to verify during build: HTTP auth hooks may be gated to paid plans on your project. If they are, this endpoint still ships and gets wired up the moment the plan allows it, and I'll tell you rather than leaving it silently inert. Password resets initiated from inside the app will route through our own breach-checked server function regardless, so the gap would be limited to dashboard-originated actions.

The `SUPA_auth_leaked_password_protection` scan finding stays open, as you asked.

## 3. Client role and portal

`app_role` already has `admin`, `staff`, `user` — no enum change needed. Today only `admin` is used anywhere.

**Access model for `user`:** a client sees only rows whose `contact_email` matches their own confirmed account email (`auth.jwt() ->> 'email'`), matched case-insensitively. No `user_id` column, so quotes submitted before the account existed still appear.

New RLS policies (delivered as `supabase/schema/003_client_role.sql` for you to run):
- `quotes`: SELECT own by email — exposes status, quote number, dates, and their own submitted answers. Never `internal_notes`, `source_ip`, or other clients' rows.
- `quote_files`: SELECT own via the parent quote's email.
- `proposals`: SELECT own via parent quote, and only where status is `sent`, `approved`, `changes_requested`, or `declined` — drafts stay admin-only.
- Writes stay service-role only, unchanged.

**Portal routes** under `src/routes/_authenticated/portal/`:
- `/portal` — list of the client's quotes with status badges.
- `/portal/quotes/$id` — submitted details, attached files via signed URLs, and any released proposal with the same accept / request-changes / decline actions as the token link.
- The existing `/proposal/{token}` public link keeps working unchanged for clients who never sign up.

**Routing by role:** after sign-in, `admin`/`staff` land on `/admin`, `user` lands on `/portal`. Each subtree checks its own role server-side; a client hitting `/admin` gets bounced.

## 4. Sign-up surfaces

- **Public** `/auth` gains a Sign in / Sign up tab pair. Self-registration always grants the `user` role only — never `admin` or `staff`, and the role is assigned server-side, never from client input.
- **Admin-only** "Create team member" form in the admin portal for `admin`/`staff` accounts, reusing the same breach check and calling the same server function with an elevated-role branch that verifies the caller is an admin first.

## Technical notes

- New dep: `@zxcvbn-ts/core` + `@zxcvbn-ts/language-en`.
- New files: `src/lib/password.ts` (shared rules), `src/components/PasswordField.tsx`, `src/lib/auth.functions.ts`, `src/routes/api/public/auth-hooks/password-check.ts`, portal routes, `supabase/schema/003_client_role.sql`.
- Modified: `src/routes/auth.tsx`, `_authenticated/route.tsx` (role-aware redirect), admin index (create-user form).
- HIBP is called with `Add-Padding: true`; a network failure fails closed with a retry message rather than silently allowing a breached password.
- Email confirmation stays on, so `signUp` never returns a session — the UI shows a "check your email" state.

## You'll need to do

1. Run `supabase/schema/003_client_role.sql` in the SQL editor.
2. Configure the auth hook URL + secret in Authentication → Hooks (I'll give exact values).
