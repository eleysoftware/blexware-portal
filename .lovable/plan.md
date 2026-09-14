# Fix "keys are missing" on the PayPal provider card

## What's actually wrong

Your PayPal keys are saved and correct. The code is looking for them under the wrong names.

Saved (both sandbox and live):
- `PAYPAL_SANDBOX_CLIENT_ID`, `PAYPAL_SANDBOX_CLIENT_SECRET`, `PAYPAL_SANDBOX_WEBHOOK_ID`
- `PAYPAL_LIVE_CLIENT_ID`, `PAYPAL_LIVE_CLIENT_SECRET`, `PAYPAL_LIVE_WEBHOOK_ID`

The code looks for the secret as `PAYPAL_SANDBOX_SECRET` / `PAYPAL_LIVE_SECRET` — without the word `CLIENT`. So it finds the client ID, fails to find the secret, and reports the mode as unconfigured. This affects both sandbox and live, so a payment would fail the same way once the card stopped blocking it.

Confirmed by reading the running environment: the `..._CLIENT_SECRET` names are present, the `..._SECRET` names do not exist.

## The fix

Accept the `..._CLIENT_SECRET` names (the ones PayPal's own dashboard uses and the ones you saved), while still accepting the shorter `..._SECRET` names so nothing breaks for anyone who set it up the other way. One shared place decides this, so the card, the "can clients pay" check, the payment calls, and the webhook verification all agree.

After this, the card should read: PayPal Business in sandbox / test mode, keys for this mode are in place.

## Technical notes

- `src/config/payments.ts`: `paypalClientSecret()` and the credential check inside `isProviderConfigured` read `${prefix}_CLIENT_SECRET` first, then fall back to `${prefix}_SECRET`.
- `src/lib/payments/paypal.provider.server.ts`: same fallback in `paypalCredentials`, and the error message names `${prefix}_CLIENT_SECRET`.
- `.env.example`: rename the two secret entries to `PAYPAL_SANDBOX_CLIENT_SECRET` / `PAYPAL_LIVE_CLIENT_SECRET` so a fresh install matches the dashboard.
- `tests/unit/payment-provider-resolution.spec.ts`: set `PAYPAL_SANDBOX_CLIENT_SECRET` in the existing test and add a case asserting both naming forms are accepted.
- Then typecheck, build, and run the payment unit tests.
