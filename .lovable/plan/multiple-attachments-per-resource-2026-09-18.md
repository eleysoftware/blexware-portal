# Multiple attachments per resource

Today each resource entry holds at most one file. This adds support for several attachments on a single resource — pick multiple files when adding, and add or remove individual files when editing — while keeping the title + short description (250 characters) as the core of the entry.

## What changes for the user

- **Add a resource**: the attachment picker accepts multiple files at once. Chosen files appear as a removable list; each file is validated (type, 50 MB max each). Files stay optional — a title and description alone still work.
- **Edit a resource**: every existing attachment is listed with a Remove button, and more files can be attached.
- **Resource rows**: the paperclip indicator shows the file count (e.g. "3 files") instead of a single name.
- **Detail view**: each attachment gets its own row with name, size and a Download button.
- Archiving, deleting, permissions (clients manage their own posts, admins manage and archive any) all behave exactly as today, applied to the whole resource and its attachments.

## Technical details

**Schema — `supabase/schema/015_resource_attachments.sql` (manual run, migrations are disabled):**
- `create table if not exists public.project_resources` with the full 014 definition plus the new column, so 015 also works if 014 was never applied.
- `alter table public.project_resources add column if not exists attachments jsonb not null default '[]'` — each entry: `{ path, name, mime, size }`.
- One-time backfill: rows carrying the legacy single-file columns (`storage_path` set, `attachments` still empty) get that file inserted as their first attachment. Legacy columns stay in place but are no longer read by the app.
- Idempotent grants and RLS policies identical to 014 (staff read all; clients read their own project's unarchived resources; storage-object policies blocking client writes to the bucket).

**Shared rules — `src/lib/resource-rules.ts`:**
- `ResourceAttachment` type; `ResourceRecord` gains `attachments: ResourceAttachment[]`.
- Pure helpers `mergeAttachments(existing, added)` and `removeAttachment(existing, path)` for reuse and unit tests.

**Server — `src/lib/resources.functions.ts`:**
- `saveResource` reads `formData.getAll("files")`, validates and uploads each, merges into `attachments`, and removes any attachments listed in a `removePaths` field — deleting those files from storage. Replaces the single-file / `removeFile` logic.
- `deleteResource` deletes every attachment path from the bucket.
- `resourceDownloadUrl` takes the resource id plus the file path and verifies the path belongs to that resource before signing a 120-second link.
- `listResources` selects `attachments`.

**UI — `src/components/ResourcesPanel.tsx`:**
- Multi-select file input with removable chips and per-file validation messages.
- Edit dialog lists current attachments with Remove buttons plus the file picker for additions.
- Row indicator shows attachment count; detail dialog renders one download row per attachment.

**Tests — `tests/unit/resources-attachments.spec.ts`:** merge/remove helpers, backfill shape, validation still enforced per file.

## Rollout

1. Write the code and migration file; typecheck and tests pass.
2. User runs `015_resource_attachments.sql` in the Supabase SQL editor (safe whether or not 014 was applied). Until then the tab keeps working as it does today.
