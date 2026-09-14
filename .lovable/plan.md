# Clarify confirmation email sender on sign-up

Update the post-sign-up "Check your email" message in `src/routes/auth.tsx` so clients know the confirmation email they receive is sent by Supabase Auth.

## Change

In the `SignUpForm` `done` state, replace the current copy with text that explicitly names Supabase Auth as the sender, e.g.:

> We sent a Supabase Auth confirmation link to **{email}**. Look for an email from Supabase Auth, confirm your address, then come back and sign in. The link can only be used once and expires, so request a fresh one if it stops working.

## Scope

- One file: `src/routes/auth.tsx` (the `done` block inside `SignUpForm`).
- No server logic, no database changes, no other routes affected.

## Verification

- Run `npx tsgo --noEmit` to confirm the JSX change type-checks.
- Visually confirm the sign-up tab shows the updated message after submitting the form.
