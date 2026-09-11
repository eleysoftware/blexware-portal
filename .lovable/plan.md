# Client portal: invoices grouped under their project

Right now the portal home lists four look-alike "PC Maintenance – Replacement" projects for the same client, three of them saying "No invoices yet". Each direct invoice created a brand new project, so the billing is scattered instead of sitting under one project.

## What changes

**1. Billing an existing project**

On the New invoice page, after picking a client, a second choice appears: add this invoice to one of that client's existing projects, or start a new project. Only new projects ask for a project name and note. This is what keeps future invoices for the same job together instead of spawning another card in the client's portal.

New invoices added to an existing project continue its installment numbering.

**2. Portal home shows invoices under each project**

Each project card on "Your projects" expands to show that project's invoices — invoice number, issue/due date, amount, status, and a Pay button on anything payable — so the client can see and pay everything from one screen without opening each project. The card keeps its summary line (outstanding amount, invoices to pay) and still links through to the full project page.

Projects with nothing to show the client yet — no sent invoices and no proposal, i.e. only unsent drafts — are hidden from the portal so empty placeholder cards stop appearing.

**3. Tidying the existing duplicates**

The three empty projects already created (BLX-2026-0101 to 0103) will disappear from the client's portal once the rule above is in place. If you'd rather delete them outright, say so and I'll remove them from the team side too.

## Technical notes

- `src/lib/direct-invoice.functions.ts`: `createDirectInvoice` accepts an optional `quoteId`; when present it skips the `quotes` insert, verifies the project belongs to the chosen client, and starts `sequence` after the project's current maximum. Add `listClientProjects` (admin-gated) returning each client's projects with id, number, name and status.
- `src/routes/_authenticated/admin/invoices/new.tsx`: project step becomes "existing project" vs "new project"; project name/note fields only render for the new-project branch.
- `src/lib/portal.functions.ts`: `listMyQuotes` returns the client-visible invoice rows per quote (number, sequence, amount, amount paid, status, due/issue date, pay token) alongside the existing rollup, and omits quotes with no client-visible invoices, no proposal and status past intake.
- `src/routes/_authenticated/portal/index.tsx`: card becomes a disclosure — summary row plus an expandable invoice list reusing the same status logic and `Pay` link (`/invoice/$token` with `return`) that `EngagementPanel` uses; extract that row into a small shared component so both stay identical.
- No schema migration.

## Separately: the "Edit with Lovable" badge

That badge only appears on Lovable preview/published surfaces. It's turned off in Project settings > Publish ("Show Lovable badge"), which requires a Pro plan. I can flip it for you on request.
