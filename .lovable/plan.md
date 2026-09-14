# "Still not delivered: TM_5001: Resource Limit Exhausted"

## What this is

That message is coming back from your email provider (ZeptoMail), not from the app. The app asked it to send the invoice, and it refused. `TM_5001 / Resource Limit Exhausted` means the sending account has run out of email credits (or hit its allowance for the period).

So this is an account/billing issue at the provider, not a bug in the invoice code. The good news: the new delivery bookkeeping worked exactly as intended — the invoice was **not** falsely marked as sent, and the real reason was shown to you.

## What you need to do (outside the app)

Sign in to the ZeptoMail console and top up / renew the sending credits for the account used by `quote@blexware.com`. Once credits are available, press **Retry** on the invoice in the team queue and it will go out. Nothing needs to be re-created.

## What I will change in the app

1. **Translate provider codes into plain English.** Instead of `TM_5001: Resource Limit Exhausted`, the queue and the invoice form will say: "Not delivered — the email account is out of sending credits. Top up ZeptoMail, then press Retry." The raw code stays available as a tooltip/secondary line so it can still be matched against provider support.
   Also covered: sender domain not verified, invalid recipient, missing key (not configured), and network failure — each with a short, actionable sentence.

2. **Warn once at the top of the admin queue.** If any invoice failed for the out-of-credits reason in the last 7 days, show a single banner at the top of `/admin`: "Emails are not going out — the email account is out of sending credits." This stops it from being discovered one invoice at a time.

3. **Don't keep hammering the provider.** The nightly scheduled-send job will stop attempting further sends in that run after it sees an out-of-credits refusal, record the reason on the remaining invoices, and report it in the heartbeat line, rather than burning through every scheduled invoice with the same failure.

4. **Copy the invoice link from the admin side.** Every invoice row in the team queue and on the project page gets a "Copy payment link" action that puts the client's invoice URL on the clipboard. You can paste it into your own email or a text message whenever the mail provider is refusing sends — no send attempt required, and the link is the same one the client would have received.

5. **Admins don't get the client experience on that link.** When a signed-in admin opens an invoice link, the page drops the "Sign in to your portal to see all your invoices" prompt and instead shows a short admin strip: a note that you are viewing as staff, the invoice's project number, and a link back to that project in the admin workspace. Payment controls stay visible so you can still check what the client sees, but the client-portal nudges are gone.

## Technical notes

- Add a `describeEmailFailure(reason)` mapper next to `parseZeptoMailError` in `src/lib/email.server.ts`, keyed on the ZeptoMail code prefix (`TM_5001`, `SM_101`/`SM_111` domain, `SM_113` recipient) plus the internal `not_configured` / `network_error` sentinels. Returns `{ headline, action }`.
- Store the raw reason in `invoices.delivery_error` as today; format only at display time in the admin queue rows, the project page invoice rows, and the create-invoice confirmation.
- Banner: derive from the existing `invoicesByQuote` delivery fields in `listQuotes` — no new query, no schema change.
- `runScheduledWork` in `src/lib/invoicing.server.ts`: treat an out-of-credits reason as a run-level abort; mark remaining due invoices with the same `delivery_error` and include the count in the heartbeat written to `app_settings`.
- Tests: mapper returns the credits message for `TM_5001: ...`; scheduled run aborts after the first out-of-credits refusal.

## Still outstanding from before

`supabase/schema/012_invoice_delivery_state.sql` has not been run yet. Until it is, the failure reason cannot be saved against the invoice — the queue will show a generic "Not delivered" instead of the credits message.
