# Visible client sign-in + a tidier team portal

## 1. Make "Sign in" easy to find on blexware.com

Right now the site header only shows the menu and "Get a Free Quote", so a client has no way to find the portal.

- **Header (desktop):** add a **Client login** button next to "Get a Free Quote". When already signed in, it reads **My portal** and goes straight to the portal (or the team portal for staff).
- **Header (mobile menu):** same link at the bottom of the menu, above "Get a Free Quote".
- **Footer:** add a "Client portal" link under the company links.

## 2. Reorganize the team portal home

Today the top of the page is one long row of 9 mixed buttons (sign out, import, new invoice, archived, test data, cleanup, convert proposals) plus a mail-status sentence, then a row of ~15 status pills. It reads as clutter.

New layout, top to bottom:

```text
Team portal                                  [Import project] [+ New invoice]
Signed in as kamal@...   ·   Invoice mail: last ran Sep 24, 3 sent   [More v]
-------------------------------------------------------------------------------
[ Active clients 12 ] [ Awaiting you 3 ] [ Outstanding $4,200 ] [ Scheduled 2 ]
-------------------------------------------------------------------------------
Search [______________]   Status [All v]   View: (Active) (Archived)
-------------------------------------------------------------------------------
Client cards (unchanged content, cleaner header: name, email, projects,
outstanding, last activity, Edit client in the same row)
```

- **Primary actions only in the header:** Import existing project, New invoice.
- **"More" menu** (dropdown) holds the rarely used tools: Show/Hide test data, Clean up test clients, Convert existing proposals, Sign out.
- **Summary tiles** give a one-glance overview (counts from data already loaded — no new data).
- **Status pills become a single "Status" dropdown** with counts; Active/Archived becomes a two-option toggle next to it.
- **Client card header:** "Edit client" moves into the header row instead of its own line underneath.
- The out-of-credits warning stays, just placed above the tiles.

Nothing about what each project row shows or does changes.

## Technical notes

- `src/components/Header.tsx`: session check client-side via `supabase.auth.getSession()` + `onAuthStateChange` in an effect (SSR renders "Client login" by default); links to `/auth` or `/portal`.
- `src/components/Footer.tsx`: add `/auth` link.
- `src/routes/_authenticated/admin/index.tsx`: restructure the PageHero children and filter bar; use existing `ui/dropdown-menu` and `ui/select`; tiles computed from `clients`, `billing`, `invoicesByQuote`. No server or schema change.

## 3. Make invoice dates explicit and editable

- The new-invoice form will show **Send date** and **Due date** together, including each installment in a payment plan.
- Existing draft or scheduled invoices get an **Edit dates** action. Sent or paid invoices keep their historical send date locked, while the due date remains editable for legitimate extensions.
- Project-generated invoice schedules will show the calculated dates before creation instead of hiding them behind the project start date.
- Date changes will be recorded in the existing audit history.

## 4. Show client portal activation clearly

Add a small account-status indicator beside each client on the team portal:

- **No account** — no portal account exists for the client's email.
- **Account created** — an account exists but has never signed in.
- **Portal active** — show the most recent sign-in date.

This lookup stays admin-only and returns only the status and last sign-in time; no private authentication details are exposed.

## 5. Remind clients every three business days after an unpaid invoice is due

- Begin reminders after the invoice due date, then repeat every three business days while a balance remains.
- Stop automatically when the invoice is paid, voided, or cancelled.
- Send both email and SMS. Email links directly to the invoice; SMS uses a concise balance reminder and the same secure payment link.
- Add delivery history and the next reminder date to the admin invoice view, with pause/resume controls.
- Claim each reminder before sending so overlapping runs cannot notify a client twice.
- Business days skip Saturdays and Sundays. US federal holidays are not skipped unless a holiday calendar is added later.
- Reuse the existing scheduled-work endpoint, but configure an external daily scheduler because no scheduler is currently defined in the app.

### Required setup

- Configure BLEXware's owned email domain for managed sending. The project currently has no sender domain configured.
- Connect an SMS provider and supply its credentials. Client phone numbers must be present, and SMS consent plus opt-out handling must be enforced before texting.

## Technical notes for invoice reminders

- Add invoice reminder state: next reminder time, last reminder time, reminder count, paused state, and last email/SMS outcomes.
- Add weekend-skipping business-day helpers with focused tests.
- Add a reminder email template and SMS sender behind server-only helpers.
- Update payment and status transitions to cancel future reminders immediately when no balance remains or the invoice is closed.
- Extend the existing scheduled-work pass rather than creating a second reminder loop.
