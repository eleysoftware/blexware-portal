# Payments still using Hyperswitch after switching to PayPal

## What I found

The provider and mode you pick in the admin card are saved in the database, but parts of the payment code never read that choice — they read stored environment settings instead, and those still say **Hyperswitch / sandbox**. Confirmed in this environment: the stored `PAYMENTS_PROVIDER` value is `hyperswitch` and `HYPERSWITCH_ENVIRONMENT` is `sandbox`.

So today there are two sources of truth:

```text
Admin card (database)      -> PayPal Business / Sandbox
Stored settings (env vars) -> hyperswitch / sandbox
```

Which one wins depends on which piece of code is asking:

- The invoice page decides whether to show payment at all by asking the env-based config, which checks Hyperswitch keys — not PayPal's.
- The PayPal code picks sandbox vs live credentials from an env var, never from the admin Environment toggle, so flipping to Live would keep using sandbox keys.
- The Hyperswitch pieces (URLs, keys, mode badge) all come from env vars too.

## What to change

1. **One source of truth.** The database setting from the admin card decides the provider and the mode. Environment values are used only as a starting default when no setting has been saved yet — never as an override.
2. **Mode reaches the provider.** The active mode (sandbox or live) is passed into the PayPal and Hyperswitch code so credentials, API hosts and the browser SDK all match what the admin card shows. Flipping to Live then actually uses the live keys.
3. **Honest "payments available" check.** The invoice page checks that the *active* provider is configured (PayPal keys for PayPal, Hyperswitch keys for Hyperswitch), instead of always checking Hyperswitch.
4. **Show the truth in the admin card.** Under the provider toggles, show the active provider and mode plus a short line confirming its credentials are present, so a mismatch is visible immediately rather than at payment time.
5. **Verify in sandbox.** After the change, start a payment on a test invoice and confirm the PayPal buttons appear, the attempt is recorded against PayPal/sandbox, and the invoice updates on capture.

Nothing about quotes, estimates, SOWs, invoices, clients or emails changes.

## Technical notes

- `src/lib/payments/service.server.ts`: remove the `PAYMENT_PROVIDER` / `PAYMENT_ENVIRONMENT` env short-circuit in `getActiveProviderName` / `getActiveEnvironment`; read `app_settings` first (via `getPaymentProviderSettings` in `settings.server.ts`, one shared reader), fall back to env only when no row exists. Also fold `PAYMENTS_PROVIDER` into that fallback so the plural/singular name mismatch stops mattering.
- `PaymentProvider` interface gains an environment argument (or the providers are created via a factory taking `"sandbox" | "live"`): `paypal.provider.server.ts` stops calling `paypalEnvironment()` from env and takes the resolved mode for `credentials()`, `baseUrl()` and `publicConfig()`; token cache key already includes environment. `hyperswitch.provider.server.ts` likewise resolves its API base and mode from the passed value.
- `src/config/payments.ts`: keep env accessors as defaults only; `isPaymentsConfigured()` becomes provider-aware and is replaced at the call site in `src/lib/invoice.functions.ts` with `await PaymentService.isConfigured()`.
- `src/components/admin/PaymentEnvironmentCard.tsx` + `getPaymentProviderSettingsFn`: return a `credentialsPresent` flag per provider/mode (boolean only, never key material) and render it.
- No schema change; `supabase/schema/011_payment_provider_environment.sql` already seeds `payment_provider` / `payment_environment`.
- Tests: provider resolution prefers the database setting over env; PayPal in live mode uses live credentials and the live API host; `isConfigured` reflects the active provider.
