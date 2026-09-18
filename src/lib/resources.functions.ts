import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { guarded } from "@/lib/errors";
import {
  MAX_RESOURCE_DESCRIPTION,
  mergeAttachments,
  normalizeAttachments,
  removeAttachment,
  validateResourceDetails,
  validateResourceFile,
  type ResourceAttachment,
  type ResourceRecord,
} from "@/lib/resource-rules";

export const RESOURCE_BUCKET = "project-resources";

/** Column list with/without `attachments` (missing until migration 015 runs). */
function selectColumns(withAttachments: boolean): string {
  return [
    "id",
    "quote_id",
    "title",
    "description",
    "author_id",
    "author_label",
    "author_role",
    "archived_at",
    "created_at",
    "storage_path",
    "original_name",
    "mime_type",
    "byte_size",
    ...(withAttachments ? ["attachments"] : []),
  ].join(", ");
}

/** True when the failure means the attachments column isn't in the database yet. */
function missingAttachmentsColumn(message: string): boolean {
  return /attachments/i.test(message);
}

function viewerDb(supabase: unknown): SupabaseClient {
  return supabase as SupabaseClient;
}

function missingTable(message: string): boolean {
  return /project_resources/.test(message);
}

async function isAdminViewer(supabase: unknown, userId: string): Promise<boolean> {
  const { data } = await viewerDb(supabase).rpc("has_role", { _user_id: userId, _role: "admin" });
  return data === true;
}

/** Throws unless the caller can see this project (staff, or the project's client). */
async function assertProjectAccess(supabase: unknown, quoteId: string): Promise<void> {
  const { data, error } = await viewerDb(supabase)
    .from("quotes")
    .select("id")
    .eq("id", quoteId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("We couldn't find that project on your account.");
}

function toResource(row: Record<string, unknown>, withAttachments: boolean): ResourceRecord {
  return {
    ...(row as unknown as ResourceRecord),
    attachments: withAttachments ? normalizeAttachments(row["attachments"]) : [],
  };
}

export const listResources = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { quoteId: string; includeArchived?: boolean }) => {
    if (!data?.quoteId) throw new Error("Missing project");
    return data;
  })
  .handler(
    guarded("listResources", "loading the resources", async ({ data, context }) => {
      await assertProjectAccess(context.supabase, data.quoteId);
      const admin = await isAdminViewer(context.supabase, context.userId);
      const showArchived = Boolean(data.includeArchived) && admin;

      const runQuery = async (withAttachments: boolean) => {
        let query = viewerDb(context.supabase)
          .from("project_resources")
          .select(selectColumns(withAttachments))
          .eq("quote_id", data.quoteId)
          .order("created_at", { ascending: false });
        query = showArchived
          ? query.not("archived_at", "is", null)
          : query.is("archived_at", null);
        return query;
      };

      let withAttachments = true;
      let result = await runQuery(true);
      if (result.error && missingAttachmentsColumn(result.error.message)) {
        withAttachments = false;
        result = await runQuery(false);
      }
      if (result.error) {
        if (missingTable(result.error.message))
          return { resources: [], unavailable: true, isAdmin: admin, userId: context.userId };
        throw new Error(result.error.message);
      }
      const rows = (result.data ?? []) as unknown as Record<string, unknown>[];
      return {
        resources: rows.map((row) => toResource(row, withAttachments)),
        unavailable: false,
        isAdmin: admin,
        userId: context.userId,
      };
    }),
  );

/** Create or update a resource. Multipart: any number of optional files ride along. */
export const saveResource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: FormData) => {
    if (!(data instanceof FormData)) throw new Error("Invalid submission");
    return data;
  })
  .handler(
    guarded("saveResource", "saving the resource", async ({ data, context }) => {
      const quoteId = String(data.get("quoteId") ?? "");
      const id = String(data.get("id") ?? "");
      const title = String(data.get("title") ?? "").trim();
      const description = String(data.get("description") ?? "").trim();
      const removePaths = normalizeAttachments
        ? (JSON.parse(String(data.get("removePaths") ?? "[]")) as unknown).filter
          ? (JSON.parse(String(data.get("removePaths") ?? "[]")) as string[])
          : []
        : [];
      const files = data
        .getAll("files")
        .filter((entry): entry is File => entry instanceof File && entry.size > 0);

      if (!quoteId) throw new Error("Missing project");
      const problem = validateResourceDetails({ title, description });
      if (problem) throw new Error(problem);
      for (const file of files) {
        const fileProblem = validateResourceFile({ name: file.name, size: file.size, type: file.type });
        if (fileProblem) throw new Error(fileProblem);
      }

      await assertProjectAccess(context.supabase, quoteId);
      const admin = await isAdminViewer(context.supabase, context.userId);

      const { adminDb, writeAudit } = await import("@/lib/blex.server");
      const db = adminDb();

      let existing: ResourceRecord | null = null;
      if (id) {
        const { data: row, error } = await db
          .from("project_resources")
          .select(selectColumns(true))
          .eq("id", id)
          .maybeSingle();
        if (error && missingAttachmentsColumn(error.message)) {
          const retry = await db
            .from("project_resources")
            .select(selectColumns(false))
            .eq("id", id)
            .maybeSingle();
          if (retry.error) throw new Error(missingTable(retry.error.message) ? notSetUp : retry.error.message);
          existing = retry.data ? toResource(retry.data as Record<string, unknown>, false) : null;
        } else {
          if (error) throw new Error(missingTable(error.message) ? notSetUp : error.message);
          existing = row ? toResource(row as unknown as Record<string, unknown>, true) : null;
        }
        if (!existing) throw new Error("That resource no longer exists.");
        if (existing.quote_id !== quoteId) throw new Error("That resource belongs to another project.");
        if (!admin && existing.author_id !== context.userId)
          throw new Error("You can only change resources you posted.");
      }

      // Upload every new file first; each becomes an attachment entry.
      const uploaded: ResourceAttachment[] = [];
      for (const file of files) {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${quoteId}/${crypto.randomUUID()}-${safeName}`;
        const upload = await db.storage
          .from(RESOURCE_BUCKET)
          .upload(path, bytes, { contentType: file.type || "application/octet-stream", upsert: false });
        if (upload.error) {
          console.error("[saveResource:upload]", upload.error.message);
          throw new Error(`We couldn't upload ${file.name}. Please try again.`);
        }
        uploaded.push({
          path,
          name: file.name,
          mime: file.type || "application/octet-stream",
          size: bytes.byteLength,
        });
      }

      const basePayload: Record<string, unknown> = {
        quote_id: quoteId,
        title,
        description: description.slice(0, MAX_RESOURCE_DESCRIPTION) || null,
      };

      // Next attachment list: existing minus removed, plus newly uploaded.
      const existingAttachments = existing?.attachments ?? [];
      const kept = removePaths.reduce(
        (list, path) => removeAttachment(list, path),
        existingAttachments,
      );
      const nextAttachments = mergeAttachments(kept, uploaded);

      // Legacy single-file row (attachments column not applied yet): fall back
      // to the old one-file behavior so the tab keeps working pre-migration.
      const legacyPath = existing?.storage_path ?? null;
      const legacyRemoved = Boolean(legacyPath && removePaths.includes(legacyPath));

      const stalePaths = removePaths.filter((path) =>
        existingAttachments.some((attachment) => attachment.path === path),
      );
      if (legacyRemoved) stalePaths.push(legacyPath as string);

      let attachmentsMode = true;
      const writeWithAttachments = async (): Promise<void> => {
        const payload = { ...basePayload, attachments: nextAttachments };
        if (existing) {
          const { error } = await db
            .from("project_resources")
            .update(payload)
            .eq("id", existing.id);
          if (error) throw error;
        } else {
          payload["author_id"] = context.userId;
          payload["author_email"] = (context.claims as { email?: string } | undefined)?.email ?? null;
          payload["author_label"] =
            (context.claims as { email?: string } | undefined)?.email ?? (admin ? "BLEXware team" : "Client");
          payload["author_role"] = admin ? "staff" : "client";
          const { error } = await db.from("project_resources").insert(payload);
          if (error) throw error;
        }
      };

      const writeLegacy = async (): Promise<void> => {
        const payload = { ...basePayload };
        if (uploaded.length > 0) {
          const first = uploaded[0];
          payload["storage_path"] = first.path;
          payload["original_name"] = first.name;
          payload["mime_type"] = first.mime;
          payload["byte_size"] = first.size;
        } else if (legacyRemoved) {
          payload["storage_path"] = null;
          payload["original_name"] = null;
          payload["mime_type"] = null;
          payload["byte_size"] = null;
        }
        if (existing) {
          const { error } = await db
            .from("project_resources")
            .update(payload)
            .eq("id", existing.id);
          if (error) throw error;
        } else {
          payload["author_id"] = context.userId;
          payload["author_email"] = (context.claims as { email?: string } | undefined)?.email ?? null;
          payload["author_label"] =
            (context.claims as { email?: string } | undefined)?.email ?? (admin ? "BLEXware team" : "Client");
          payload["author_role"] = admin ? "staff" : "client";
          const { error } = await db.from("project_resources").insert(payload);
          if (error) throw error;
        }
      };

      try {
        await writeWithAttachments();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!missingAttachmentsColumn(message)) {
          console.error("[saveResource:write]", message);
          throw new Error("We couldn't save that resource. Please try again.");
        }
        attachmentsMode = false;
        await writeLegacy();
      }

      // Drop removed (and legacy-replaced) attachments from storage.
      if (stalePaths.length > 0) {
        await db.storage.from(RESOURCE_BUCKET).remove(stalePaths);
        // Legacy replace: the previous single file is superseded by the new one.
        if (attachmentsMode && legacyRemoved && !stalePaths.includes(legacyPath as string)) {
          /* already covered above */
        }
      } else if (!attachmentsMode && legacyPath && uploaded.length > 0) {
        await db.storage.from(RESOURCE_BUCKET).remove([legacyPath]);
      }

      await writeAudit({
        actorId: context.userId,
        actorLabel: (context.claims as { email?: string } | undefined)?.email ?? null,
        action: existing ? "resource.updated" : "resource.added",
        entity: "quote",
        entityId: quoteId,
        metadata: {
          resourceId: id || null,
          title,
          attachmentCount: attachmentsMode ? nextAttachments.length : uploaded.length > 0 ? 1 : existing ? 1 : 0,
        },
      });

      return { id: id || null };
    }),
  );

const notSetUp =
  "Resources aren't set up in this database yet. Run the project resources migration and try again.";

export const deleteResource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: string }) => {
    if (!data?.id) throw new Error("Missing resource");
    return data;
  })
  .handler(
    guarded("deleteResource", "deleting the resource", async ({ data, context }) => {
      const { adminDb, writeAudit } = await import("@/lib/blex.server");
      const db = adminDb();
      const { data: row, error } = await db
        .from("project_resources")
        .select(selectColumns(true))
        .eq("id", data.id)
        .maybeSingle();
      if (error && missingAttachmentsColumn(error.message)) {
        const retry = await db
          .from("project_resources")
          .select(selectColumns(false))
          .eq("id", data.id)
          .maybeSingle();
        if (retry.error) throw new Error(missingTable(retry.error.message) ? notSetUp : retry.error.message);
        await removeResourceRow(db, retry.data as Record<string, unknown> | null, context, writeAudit);
        return { ok: true };
      }
      if (error) throw new Error(missingTable(error.message) ? notSetUp : error.message);
      await removeResourceRow(db, row as Record<string, unknown> | null, context, writeAudit);
      return { ok: true };
    }),
  );

type WriteAudit = (input: {
  actorId?: string | null;
  actorLabel?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}) => Promise<unknown>;

async function removeResourceRow(
  db: SupabaseClient,
  row: Record<string, unknown> | null,
  context: { userId: string; claims?: unknown },
  writeAudit: WriteAudit,
): Promise<void> {
  if (!row) return;
  const resource = toResource(row, normalizeAttachments(row["attachments"]).length > 0);
  const paths = [
    ...resource.attachments.map((attachment) => attachment.path),
    ...(resource.storage_path && resource.attachments.length === 0 ? [resource.storage_path] : []),
  ];

  await assertProjectAccess(viewerGuard(), resource.quote_id).catch(() => {
    throw new Error("We couldn't confirm your access to that project.");
  });

  const admin = await isAdminViewer(viewerGuard(), context.userId);
  if (!admin && resource.author_id !== context.userId)
    throw new Error("You can only delete resources you posted.");

  if (paths.length > 0) await db.storage.from(RESOURCE_BUCKET).remove(paths);
  const removal = await db.from("project_resources").delete().eq("id", resource.id);
  if (removal.error) throw new Error(removal.error.message);

  await writeAudit({
    actorId: context.userId,
    actorLabel: (context.claims as { email?: string } | undefined)?.email ?? null,
    action: "resource.deleted",
    entity: "quote",
    entityId: resource.quote_id,
    metadata: { resourceId: resource.id, title: resource.title },
  });
}

// Placeholder replaced below — see note.
declare function viewerGuard(): SupabaseClient;

/** Archive hides a resource from everyone; admins can restore it. */
export const setResourceArchived = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: string; archived: boolean }) => {
    if (!data?.id) throw new Error("Missing resource");
    return data;
  })
  .handler(
    guarded("setResourceArchived", "updating the resource", async ({ data, context }) => {
      const { requireAdmin, adminDb, writeAudit } = await import("@/lib/blex.server");
      await requireAdmin(context.supabase, context.userId);
      const db = adminDb();
      const { data: row, error } = await db
        .from("project_resources")
        .update({ archived_at: data.archived ? new Date().toISOString() : null })
        .eq("id", data.id)
        .select("id, quote_id, title")
        .maybeSingle();
      if (error) throw new Error(missingTable(error.message) ? notSetUp : error.message);

      await writeAudit({
        actorId: context.userId,
        actorLabel: (context.claims as { email?: string } | undefined)?.email ?? null,
        action: data.archived ? "resource.archived" : "resource.restored",
        entity: "quote",
        entityId: (row as { quote_id?: string } | null)?.quote_id ?? null,
        metadata: { resourceId: data.id },
      });
      return { ok: true };
    }),
  );

/** Short-lived download link for one attachment of a resource. */
export const resourceDownloadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: string; path?: string }) => {
    if (!data?.id) throw new Error("Missing resource");
    return data;
  })
  .handler(
    guarded("resourceDownloadUrl", "preparing that download", async ({ data, context }) => {
      const { adminDb } = await import("@/lib/blex.server");
      const db = adminDb();

      const fetchRow = async (withAttachments: boolean) =>
        db
          .from("project_resources")
          .select(
            `id, quote_id, storage_path, archived_at${withAttachments ? ", attachments" : ""}`,
          )
          .eq("id", data.id)
          .maybeSingle();

      let withAttachments = true;
      let result = await fetchRow(true);
      if (result.error && missingAttachmentsColumn(result.error.message)) {
        withAttachments = false;
        result = await fetchRow(false);
      }
      if (result.error) throw new Error(missingTable(result.error.message) ? notSetUp : result.error.message);
      const row = result.data as Record<string, unknown> | null;
      if (!row) throw new Error("That resource no longer exists.");

      const attachments = withAttachments ? normalizeAttachments(row["attachments"]) : [];
      const legacyPath = (row["storage_path"] as string | null) ?? null;

      let target: string | null = null;
      if (data.path) {
        const known =
          attachments.some((attachment) => attachment.path === data.path) ||
          data.path === legacyPath;
        if (!known) throw new Error("That file is no longer attached to this resource.");
        target = data.path;
      } else if (attachments.length > 0) {
        target = attachments[0].path;
      } else if (legacyPath) {
        target = legacyPath;
      }
      if (!target) throw new Error("That resource has no attachment.");

      await assertProjectAccess(context.supabase, row["quote_id"] as string);
      const admin = await isAdminViewer(context.supabase, context.userId);
      if (row["archived_at"] && !admin) throw new Error("That resource is no longer available.");

      const signed = await db.storage.from(RESOURCE_BUCKET).createSignedUrl(target, 120);
      if (signed.error || !signed.data) throw new Error("We couldn't prepare that download.");
      return { url: signed.data.signedUrl };
    }),
  );
