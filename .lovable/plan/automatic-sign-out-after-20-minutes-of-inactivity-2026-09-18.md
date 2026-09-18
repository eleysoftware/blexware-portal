# Automatic sign-out after 20 minutes of inactivity

Anyone signed in to the portal or the admin area is signed out automatically after 20 minutes with no activity, and sent back to the sign-in page with a short note explaining why.

## How it behaves

- Activity means mouse movement, clicks, key presses, scrolling, touches, or switching back to the tab.
- Any activity resets the 20-minute clock.
- At 19 minutes a small warning appears: "You'll be signed out in 1 minute" with a "Stay signed in" button.
- At 20 minutes the session ends and the browser goes to the sign-in page with the message "You were signed out after 20 minutes of inactivity."
- The timer is shared across open tabs, so working in one tab keeps the others alive, and signing out closes all of them.
- Closing the browser and coming back later also lands on sign-in, since the last-activity time is checked on load.

## Technical notes

- New `src/hooks/use-idle-timeout.ts`: tracks last activity in `localStorage` (shared across tabs via the `storage` event), throttled writes, `setTimeout`-based checks that also re-verify elapsed time on `visibilitychange` so a backgrounded tab cannot stall the clock.
- New `src/components/IdleTimeoutGuard.tsx`: mounts the hook, renders the 1-minute warning dialog (existing `AlertDialog`), and on expiry calls `supabase.auth.signOut()` then navigates to `/auth?reason=timeout`.
- Mounted once inside `src/routes/_authenticated/route.tsx` around `<Outlet />`, so it covers both admin and client portal and nothing else.
- `src/routes/auth.tsx` reads `reason=timeout` from the search params and shows the explanatory message above the sign-in form.
- Timeout and warning lead time defined as constants (20 min / 1 min) in one place for easy adjustment.
- No database or server changes; Supabase token refresh continues normally while the user is active.
