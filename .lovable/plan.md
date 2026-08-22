# Fix email confirmation links landing on localhost:3000

Clicking "Confirm your email" sends you to `http://localhost:3000/#error=access_denied&error_code=otp_expired...`. Two separate problems are stacked here:

1. **Wrong destination.** Supabase Auth's Site URL for this project is still `http://localhost:3000`, and the app never tells Supabase where to send people back. Nothing in the codebase sets a redirect for confirmation emails, and there is no callback route to receive one.
2. **Link already consumed / expired.** `otp_expired` means the one-time token was used or timed out before your browser got there — commonly because the confirmation email is resent (a second link invalidates the first) or an email scanner opens the link first.

## What to change

**Supabase Auth settings (dashboard, you or me via config):**
- Site URL: `https://www.blexware.com`
- Additional redirect URLs: the published URL, the Lovable preview URL, and `http://localhost:8080/**` for local work (the dev server runs on 8080, not 3000).
- Raise the confirmation link lifetime from the default so slower email delivery doesn't expire tokens.

**App changes:**
- Add a public `/auth/callback` route that reads the token/hash from the URL, establishes the session, and routes the user onward: staff to `/admin`, clients to `/portal`. On failure it shows a readable message with a "resend confirmation email" button instead of a blank unreachable page.
- Pass an explicit `emailRedirectTo` pointing at `${window.location.origin}/auth/callback` on every place we trigger a confirmation email, so the link follows whichever environment the user actually signed up in rather than the global Site URL.
- Remove the immediate extra `resend` call in the sign-up flow: the account creation already triggers a confirmation email, and the second one invalidates the first link — a likely contributor to `otp_expired`. Keep resend as an explicit user-triggered button on the "check your email" screen and on the callback error state.

## Technical notes

- New file: `src/routes/auth.callback.tsx` (public, `ssr: false`, `noindex`), handling both the modern `?code=` PKCE exchange and the legacy `#access_token` hash form.
- Modified: `src/routes/auth.tsx` (drop the auto-resend, add manual resend, pass `emailRedirectTo`), `src/lib/auth.functions.ts` (accept and forward a redirect URL when creating the account).
- No database or RLS changes.

## You'll need to do

Confirm I should update the Supabase Auth URL configuration, or apply the Site URL / redirect allow-list changes yourself in the dashboard — the links stay broken until that list includes the real site URLs.
