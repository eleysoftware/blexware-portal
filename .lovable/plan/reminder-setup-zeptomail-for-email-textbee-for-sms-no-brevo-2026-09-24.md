# Reminder setup: ZeptoMail for email, Textbee for SMS, no Brevo

## Answers
1. **Yes, keep ZeptoMail.** Invoice and reminder emails already go through ZeptoMail from quote@blexware.com. No new sender domain is needed. The only blocker is the ZeptoMail account running out of credits (the earlier "TM_5001" error). Top up credits in ZeptoMail and reminder emails start working.
2. **Correct — Brevo is not needed.** Client names, emails and phone numbers already live in the Supabase database, so there is no separate contact list to maintain. Textbee.dev handles the text messages. Brevo can be disconnected from the project.

## What gets built
- **Client mobile number and text consent:** the quote form, the direct invoice form and the Edit client dialog get an optional mobile number and a "text me invoice reminders" checkbox. Only clients who tick the box get texts.
- **Reminder texts through Textbee:** every three business days after the due date, clients who opted in get a short text along with the email. Example: "BLEXware: invoice INV-123 has $X outstanding. Pay: <link>. Reply STOP to opt out." Texts use the same timing as the email reminders.
- **Admin visibility:** each invoice shows how many email and text reminders were sent and when the last one went out.
- **Opt-out:** admins can switch off texts for a client in Edit client. Textbee doesn't handle STOP replies automatically, so a STOP reply gets turned off by hand.
- **Disconnect Brevo:** the Brevo connection is removed from this project, since nothing uses it anymore.

## What you need to do
- In Textbee.dev: create an account, install the Textbee app on an Android phone with an active SMS plan, and register the phone as a device.
- Copy your Textbee **API key** and **Device ID**. You'll paste them into a secure form I'll open.
- Keep the phone switched on, charged and online. Texts only go out while it's connected.

## Technical details
- Email stays on the existing ZeptoMail sender. Nothing changes there.
- New helper `src/lib/sms.server.ts` sends texts with `POST https://api.textbee.dev/api/v1/gateway/devices/{TEXTBEE_DEVICE_ID}/send-sms`, using the header `x-api-key: TEXTBEE_API_KEY` and the body `{ recipients: [e164], message }`.
- Secrets: `TEXTBEE_API_KEY` and `TEXTBEE_DEVICE_ID`, added through the secure form.
- Phone numbers are converted to international format (E.164) before they're saved. Invalid numbers are rejected on the form.
- Migration 018 has to be run by hand in the Supabase SQL editor:
  - on quotes: `contact_phone`, `sms_opt_in`, `sms_opt_in_at`
  - on invoices: `sms_reminder_count`, `last_sms_reminder_at`
- Migration 017 still needs to be applied too.
- A text is skipped, and the reason recorded, when there's no number, no opt-in, missing Textbee keys, or a Textbee error. The email reminder is never blocked.
- The Brevo connection (std_01m3a9bn5megmrgkdpvyqzr74x) gets disconnected from the project; no Brevo code is written.
- The roadmap entry for SMS reminders will be updated to say Textbee.
