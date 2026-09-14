# Edit client details

Give the team a way to correct a client's contact name, company, email address and phone number, with the change applying to every project that client has.

## Where it appears

- **Team queue (/admin)** — each client group gets an "Edit client" action next to the client's name.
- **Project page** — an "Edit client details" button in the client information area, opening the same form.

## The form

Fields: contact name, company (optional), email address, phone (optional).

- Pre-filled with the current details.
- Shows how many projects will be updated ("This updates 3 projects for this client").
- Validation: name required (2-80 characters), valid email (max 160), company max 120, phone max 40.
- If the new email already belongs to another client in the system, the form warns that saving will merge the two into one client and asks for confirmation before continuing.
- Saving updates every project with the old email; the queue and project page refresh immediately.

## Effect of changing the email address

The client portal shows a person the projects that match their signed-in, verified email. So changing the email address moves portal access from the old address to the new one. The form states this in one line: "The client will need to sign in with the new address to see their projects." Existing invoices, documents and payment links are unaffected — they stay attached to the same projects.

Documents already generated (proposals, SOWs, invoices PDFs) keep the name they were created with; newly generated documents use the updated details. The form notes this.

## Technical notes

- New admin-only server function `updateClientDetails` in `src/lib/admin.functions.ts`: `requireSupabaseAuth` + `requireAdmin`, Zod-validated input `{ currentEmail, contact_name, company, contact_email, phone }`, updates `public.quotes` for all rows where `lower(contact_email) = lower(currentEmail)` (including archived rows so nothing is orphaned), returns the number of rows updated. Writes a `client.details_updated` audit entry via `writeAudit` with `{ from, to, quoteCount }`.
- Email normalised to lowercase-trimmed before compare and write.
- New `src/components/admin/EditClientDialog.tsx` — shadcn `Dialog` + form, reused by both surfaces; on success invalidates `["quotes", filter, search]` and the project query.
- `listQuotes` already returns `contact_name`, `contact_email`, `company`; add `phone` to the select so the dialog can prefill from the queue.
- Project page (`src/routes/_authenticated/admin/quotes/$id.tsx`) already loads the full quote record, so it can prefill directly.
- No schema change. Client portal access rules unchanged (exact verified-email match).

## Out of scope

- Editing a client's login account or password.
- Re-generating existing PDFs/DOCX with the new details.
- A separate client record table — clients remain grouped by email on quotes.
