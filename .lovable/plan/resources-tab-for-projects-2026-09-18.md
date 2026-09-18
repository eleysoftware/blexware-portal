# Resources tab for projects

A new **Resources** tab on every project, right after Milestones, for both the team workspace and the client portal. It holds short notes and optional file attachments so instructions and reference material live with the project.

## What people will see

**The list**
- One row per resource: title, who posted it (client or team), when, and a paperclip marker plus file name when a file is attached.
- Newest first. Empty state explains what the tab is for.
- "Add a resource" button opens a form: title (required), short description (250 characters max, with a live counter), and an optional file.

**The detail view**
- Clicking a row opens its details: full title, description, who posted it, date, and — when a file is attached — a Download button. Files are served through a short-lived private link, never a public URL.

**Files**
- Optional. Up to 50 MB each, one file per resource.
- PDFs, Word, Excel, PowerPoint, text/CSV, images, and common video/audio types accepted. Clear, plain-English message when a file is too large or the type isn't allowed.

**Who can do what**
- Client: post resources on their own projects, and edit or delete the ones they posted (including replacing or removing the attached file).
- Team/admin: post resources, edit or delete any resource, and archive any resource.
- Archiving hides the resource from everyone. Admins reach archived items through a separate "Archived" view on the tab and can restore one back into the list.
- Every add, edit, delete, archive and restore is written to the activity log.

## Technical notes

**Storage**
- New private bucket `project-resources`, 50 MB file size limit. Uploads and downloads go through server functions using the service role; no browser writes (same rule as `quote-uploads` and `documents`). Downloads use a short-lived signed URL.

**Schema** (migration, mirrored as `supabase/schema/014_project_resources.sql`)
- `public.project_resources`: `quote_id` → quotes (cascade), `title`, `description` (<=250 chars, enforced in validators), `storage_path`, `original_name`, `mime_type`, `byte_size`, `author_id`, `author_email`, `author_label`, `author_role` ('client' | 'staff'), `archived_at`, `created_at`, `updated_at` + touch trigger.
- Index on `(quote_id, created_at desc)`.
- Grants: `select` to `authenticated`, `all` to `service_role`.
- RLS mirroring `project_milestones`: staff/admin read all; clients read rows on projects whose `contact_email` matches `public.viewer_email()` — plus `archived_at is null` for both client reads. Writes run through the service role in server functions, which enforce ownership.

**Server functions** — new `src/lib/resources.functions.ts`, `requireSupabaseAuth` middleware, all wrapped in `guarded(...)`:
- `listResources({ quoteId, includeArchived? })` — verifies the caller is staff or the project's client; `includeArchived` is admin-only.
- `saveResource` — create/update; multipart upload handled like the quote wizard's attachment path; enforces 250-char description, 50 MB limit and the allowed MIME list; non-admin callers may only touch rows where `author_id = caller`.
- `deleteResource` — same ownership rule; removes the storage object too.
- `setResourceArchived` — admin only.
- `resourceDownloadUrl` — access check, then `createSignedUrl` (120s) against the bucket.
- Missing-table tolerance like `listMilestones`: return `{ resources: [], unavailable: true }` if the migration hasn't run.

**UI**
- New `src/components/ResourcesPanel.tsx` (shared, takes a `role: "admin" | "client"` prop) plus a `ResourceDetailDialog`.
- Tab inserted after `{ id: "milestones" }` in `src/routes/_authenticated/admin/quotes/$id.tsx` and `src/routes/_authenticated/portal/quotes/$id.tsx`, with matching `WorkspacePanel`s.
- Existing design tokens and shadcn Dialog/Button/Input/Textarea; no new colors.

**Tests**
- Unit tests for the file/description validators (size, type, 250-char cap) and for the edit/delete ownership rule.

Note: the migration is applied through the migration tool; if it can't run in this environment, `supabase/schema/014_project_resources.sql` is provided to run manually, and the tab degrades to a friendly "not set up yet" message until then.
