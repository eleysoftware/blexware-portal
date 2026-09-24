# Reminder setup: keep ZeptoMail for email, Brevo for SMS and contacts

## Answers
1. **Yes, keep ZeptoMail.** Invoice and reminder emails already go through ZeptoMail from quote@blexware.com. No new sender domain is needed. The only blocker is the ZeptoMail account running out of credits (the earlier "TM_5001" error). Top up credits in ZeptoMail and reminder emails start working.
2. **Yes, Brevo is the SMS provider.** Brevo is already connected. We can also add each client's name, email and mobile number to a Brevo contact list (for example "BLEXware Clients"). The list is for keeping records. Reminder texts go straight to one client's number and don't need the list.

## What gets built
- **Client mobile number and text consent:** add an optional mobile number and a "text me invoice reminders" checkbox to the quote form, direct invoice form and Edit client dialog. Only clients who tick the box get texts.
- **Sync clients to Brevo:** when a client is created or edited, add or update their Brevo contact (email, first/last name, mobile number in SMS format) on the "BLEXware Clients" list. If the sync fails, it's logged. The invoice still goes out.
- **Reminder texts:** every three business days after the due date, clients who opted in get a short text alongside the email, for example "BLEXware: invoice INV-123 has $X outstanding. Pay: <link>. Reply STOP to opt out." The text uses the same timing and count as the email reminder.
- **Admin visibility:** each invoice shows how many email and text reminders were sent and when the last one went out.
- **Opt-out:** if Brevo reports a STOP reply or a blocked number, texts stop for that client.

## What you need to do in Brevo
- Buy SMS credits. Brevo SMS is prepaid.
- Set the SMS sender name "BLEXware". Some countries, including the US, need a registered number instead. Brevo walks you through this.
- Confirm the list name. "BLEXware Clients" is used by default.

## Technical details
- Email stays in the existing email sender. No change there.
- New server helper `src/lib/brevo.server.ts` goes through the connector gateway:
  - `POST /v3/contacts` with `updateEnabled: true`, `attributes.SMS` and `listIds`
  - `POST /v3/transactionalSMS/sms` with type `transactional`
- Phone numbers are converted to the international format (E.164) before saving. Invalid numbers are rejected on the form.
- New migration 018 (run it by hand in the Supabase SQL editor):
  - on quotes/clients: `contact_phone`, `sms_opt_in`, `sms_opt_in_at`
  - on invoices: `sms_reminder_count`, `last_sms_reminder_at`
- Migration 017 still needs to be applied too.
- If a number isn't set, the client hasn't opted in, or Brevo has no credits, the SMS is skipped and the reason is recorded. The email reminder is never blocked.
