# Admin control for ACH + fix the card payment error

Two issues on the client invoice payment page: ACH (Pay by Bank) is offered even though the bank connector isn't live yet, and paying by card fails with `c.split is not a function`.

## 1. Admin switch for payment methods

Today the invoice page always shows both choices and only hides ACH *after* the client picks it and the gateway rejects it — a bad first impression. Instead, availability becomes an admin setting.

- New admin-only settings store (single key/value table) holding which payment methods are offered: `card` and `bank`, each on/off.
- Admin UI: a small "Payment methods" card in the admin quote workspace's Invoices tab with two toggles — "Credit or debit card" and "Pay by bank (ACH)" — plus a note that ACH also has to be enabled with the payment provider. Changing a toggle saves immediately and is written to the audit log.
- Default state: card on, ACH off (matching today's reality). When ACH is approved, flip the toggle on and it appears for clients immediately — no code change or redeploy.
- Client invoice page: only enabled methods render. If exactly one is enabled, the chooser collapses to that method with its description. If none are enabled, the page shows the existing "reply to your invoice email" fallback.
- Server enforcement: starting a payment with a disabled method is rejected server-side, so a stale browser tab can't bypass the switch. The existing gateway-rejection fallback stays as a second layer.

## 2. Fix "c.split is not a function" on card payments

This is thrown inside the Hyperswitch checkout script when the pay button is pressed. Cause to correct in `HyperswitchCheckout.tsx`:

- The SDK is initialized with only the publishable key, so it targets its default (production) backend while our payment intents are created in the sandbox — the client secret it receives doesn't match the shape it expects to parse. Initialization will pass the matching backend URL for the current environment, and the client secret will be validated (non-empty string containing the expected separator) before the widget mounts.
- The confirm call will be tightened to the SDK's documented shape and guarded so any thrown SDK error surfaces as a friendly message with the real error logged, instead of leaking the internal text to the client.

Verification: run a sandbox card payment end-to-end in a real browser against Tamara West's invoice 1 — mount the card fields, pay with a sandbox test card, confirm the success panel, the invoice flipping to paid, and no console errors. If the initialization change alone doesn't clear it, the browser run captures the exact SDK call that throws and the fix is adjusted there before finishing.

## Technical notes

- New migration `supabase/schema/007_app_settings.sql`: `public.app_settings(key text primary key, value jsonb, updated_at, updated_by)`, GRANTs (`select, insert, update` to `authenticated`, `all` to `service_role`), RLS enabled, admin-only write and read via existing `has_role(auth.uid(),'admin')`; payment-method flags read server-side with the admin client so the public invoice route needs no anon grant.
- `src/config/payments.ts` gains `enabledPaymentMethods()` reading the DB setting with an env fallback (`PAYMENT_METHODS` / `VITE_PAYMENT_METHODS`) so non-Lovable environments stay portable; `.env.example` documented.
- `getInvoiceByToken` returns `availableMethods`; `beginInvoicePayment` / `startInvoicePayment` validate the requested method against it.
- Admin read/write through new server functions in `src/lib/admin.functions.ts`; UI in `src/components/admin/AdminEngagementPanel.tsx`.
- Unit tests: method gating in `startInvoicePayment`, and settings default resolution.
