## Goal

Turn the Free Quote form into a real, stored pipeline backed by the existing **BLEXware_site** Supabase project: PDF attachments, a secure quote record, an authenticated admin portal, and manually triggered AI proposal drafts that an admin reviews and sends.

## Step 0 — Connect the backend

Link the project to the existing **BLEXware_site** Supabase project via the Supabase connector (not a new Cloud-provisioned database), then generate the typed client, auth middleware, and env wiring against it. All schema below lands as migrations in that project.

## Step 1 — Data model (one migration, with grants + RLS)

- `quotes` — quote_number, industry, project_type, project_name, description, budget, timeline/launch_date, goals, features, contact name/email/company/phone, consent, status (`new | reviewing | proposal_draft | proposal_sent | approved | declined`), timestamps, soft-delete column.
- `quote_files` — quote_id FK, storage path, original filename, byte size, mime type, uploaded_at.
- `proposals` — quote_id FK, model used, prompt text, generated markdown, status (`draft | sent | approved | changes_requested | declined`), reviewed_by, sent_at, public review token.
- `app_role` enum + `user_roles` table + `has_role()` security-definer function (roles never on a profile row).
- `audit_log` — actor, action, entity, entity_id, metadata, created_at; insert-only.
- Explicit `GRANT`s per table, RLS enabled everywhere. No anon reads. Quote/file writes go only through server functions; admin reads gated by `has_role(auth.uid(),'admin')`.

Storage: private bucket `quote-uploads`, no public access. Admin downloads use short-lived signed URLs and each download writes an audit row.

## Step 2 — File attachment on the Free Quote form

Add PDF upload to the wizard (folded into the existing steps so the flow stays 8 steps).

- PDF only, max 20 MB, up to 3 files, with remove controls and keyboard-accessible, inline errors.
- Server-side re-validation: magic-byte check (`%PDF-`), reject encrypted/password-protected PDFs, reject files containing `/JavaScript` or `/Launch`, reject MIME/extension mismatches. Failures are rejected with a plain-language message and never stored.
- On submit, a server function stores files at `quotes/{quote_id}/{uuid}.pdf` in the private bucket.

On virus scanning: the spec asks for malware scanning. Structural PDF validation is what we can do in-platform; a real AV scan needs a third-party service (VirusTotal, ClamAV API). I'll leave a clearly marked hook and wire a provider when you pick one.

## Step 3 — Quote submission workflow

`submitQuote` server function: Zod validation → insert quote → generate a sequential quote number (`BLX-2026-0001`) → validate and store files → write audit row → return the number. Rate limiting on submissions per email/IP per hour. Confirmation screen shows the quote number and next steps. No AI runs here.

## Step 4 — Admin portal (authenticated)

- `/auth` sign-in page (email + password, plus Google sign-in).
- `/admin` under the authenticated route gate with an admin-role check; non-admins redirected.
- **Dashboard:** counts by status, recent quotes, recent proposals.
- **Quotes list:** search, filter by status/industry, sort by date.
- **Quote detail:** full submission, attached PDFs via signed-URL downloads, status control, audit trail.
- Every admin action writes an `audit_log` row.

## Step 5 — User-initiated AI proposal generation

- **Generate proposal draft** button on the quote detail page — never automatic.
- Server function builds the prompt from the quote (plus extracted PDF text where feasible), calls the Lovable AI Gateway, and stores prompt + output + model as a `draft`.
- Draft renders with a persistent "AI-generated draft — human review required" banner and the spec's sections: Executive Summary, Business Goals, Functional Requirements, Technical Requirements, Architecture, Recommended Technology, Timeline, Phases, Deliverables, Optional Features, Discovery Questions.
- Admin edits the draft, then clicks **Send to prospect** — also manual. Sending marks it `sent` and records who sent it.

Email delivery is the one open piece: actually emailing needs Resend (or similar) with a verified sending domain. I'll build the send action and state now; until Resend is connected, "send" produces a shareable review link.

## Step 6 — Public proposal review link

Read-only `/proposal/{token}` route using an unguessable token, showing the proposal with Approve / Request changes / Decline actions that update its status. No login, no other quote data exposed.

## Out of scope this phase

Contracts, invoices, payments, e-signature, CMS-backed blog/portfolio admin, Twilio SMS, MFA enrollment UI — next once the quote pipeline is solid.

## Technical notes

All backend logic uses TanStack Start server functions (`createServerFn`); no Supabase Edge Functions. Admin reads run through the authenticated Supabase context under RLS; the service-role client is used only for storage writes and signed-URL minting after the caller's admin role is verified. Secrets stay in the platform secret store.
