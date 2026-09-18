import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { guarded } from "@/lib/errors";
import {
  MAX_RESOURCE_DESCRIPTION,
  type ResourceRecord,
  validateResourceDetails,
  validateResourceFile,
} from "@/lib/resource-rules";

export const RESOURCE_BUCKET = "project-resources";

const SELECT =
  "id, quote_id, title, description, storage_path, original_name, mime_type, byte_size, author_id, author_label, author_role, archived_at, created_at";

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

      let query = viewerDb(context.supabase)
        .from("project_resources")
        .select(SELECT)
        .eq("quote_id", data.quoteId)
        .order("created_at", { ascending: false });
      query = showArchived ? query.not("archived_at", "is", null) : query.is("archived_at", null);

      const { data: rows, error } = await query;
      if (error) {
        if (missingTable(error.message))
          return { resources: [], unavailable: true, isAdmin: admin, userId: context.userId };
        throw new Error(error.message);
      }
      return {
        resources: (rows ?? []) as unknown as ResourceRecord[],
        unavailable: false,
        isAdmin: admin,
        userId: context.userId,
      };
    }),
  );

/** Create or update a resource. Multipart so an optional file can ride along. */
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
      const removeFile = String(data.get("removeFile") ?? "") === "true";
      const file = data.get("file");

      if (!quoteId) throw new Error("Missing project");
      const problem = validateResourceDetails({ title, description });
      if (problem) throw new Error(problem);

      await assertProjectAccess(context.supabase, quoteId);
      const admin = await isAdminViewer(context.supabase, context.userId);

      const { adminDb, writeAudit } = await import("@/lib/blex.server");
      const db = adminDb();

      let existing: ResourceRecord | null = null;
      if (id) {
        const { data: row, error } = await db
          .from("project_resources")
          .select(SELECT)
          .eq("id", id)
          .maybeSingle();
        if (error) throw new Error(missingTable(error.message) ? notSetUp : error.message);
        if (!row) throw new Error("That resource no longer exists.");
        existing = row as unknown as ResourceRecord;
        if (existing.quote_id !== quoteId) throw new Error("That resource belongs to another project.");
        if (!admin && existing.author_id !== context.userId)
          throw new Error("You can only change resources you posted.");
      }

      const payload: Record<string, unknown> = {
        quote_id: quoteId,
        title,
        description: description.slice(0, MAX_RESOURCE_DESCRIPTION) || null,
      };

      let uploadedPath: string | null = null;
      if (file instanceof File && file.size > 0) {
        const fileProblem = validateResourceFile({ name: file.name, size: file.size, type: file.type });
        if (fileProblem) throw new Error(fileProblem);
        const bytes = new Uint8Array(await file.arrayBuffer());
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${quoteId}/${crypto.randomUUID()}-${safeName}`;
        const upload = await db.storage
          .from(RESOURCE_BUCKET)
          .upload(path, bytes, { contentType: file.type || "application/octet-stream", upsert: false });
        if (upload.error) {
          console.error("[saveResource:upload]", upload.error.message);
          throw new Error("We couldn't upload that file. Please try again.");
        }
        uploadedPath = path;
        payload["storage_path"] = path;
        payload["original_name"] = file.name;
        payload["mime_type"] = file.type || "application/octet-stream";
        payload["byte_size"] = bytes.byteLength;
      } else if (removeFile) {
        payload["storage_path"] = null;
        payload["original_name"] = null;
        payload["mime_type"] = null;
        payload["byte_size"] = null;
      }

      // Drop a replaced or removed attachment from storage.
      const stalePath =
        existing?.storage_path && (uploadedPath || removeFile) ? existing.storage_path : null;

      let resourceId = id;
      if (existing) {
        const { error } = await db.from("project_resources").update(payload).eq("id", existing.id);
        if (error) throw new Error(missingTable(error.message) ? notSetUp : error.message);
      } else {
        payload["author_id"] = context.userId;
        payload["author_email"] = (context.claims as { email?: string } | undefined)?.email ?? null;
        payload["author_label"] =
          (context.claims as { email?: string } | undefined)?.email ?? (admin ? "BLEXware team" : "Client");
        payload["author_role"] = admin ? "staff" : "client";
        const { data: inserted, error } = await db
          .from("project_resources")
          .insert(payload)
          .select("id")
          .single();
        if (error || !inserted) throw new Error(missingTable(error?.message ?? "") ? notSetUp : "We couldn't save that resource.");
        resourceId = String((inserted as { id: string }).id);
      }

      if (stalePath) await db.storage.from(RESOURCE_BUCKET).remove([stalePath]);

      await writeAudit({
        actorId: context.userId,
        actorLabel: (context.claims as { email?: string } | undefined)?.email ?? null,
        action: existing ? "resource.updated" : "resource.added",
        entity: "quote",
        entityId: quoteId,
        metadata: { resourceId, title, hasFile: Boolean(uploadedPath || (!removeFile && existing?.storage_path)) },
      });

      return { id: resourceId };
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
        .select(SELECT)
        .eq("id", data.id)
        .maybeSingle();
      if (error) throw new Error(missingTable(error.message) ? notSetUp : error.message);
      if (!row) return { ok: true };
      const resource = row as unknown as ResourceRecord;

      await assertProjectAccess(context.supabase, resource.quote_id);
      const admin = await isAdminViewer(context.supabase, context.userId);
      if (!admin && resource.author_id !== context.userId)
        throw new Error("You can only delete resources you posted.");

      if (resource.storage_path) await db.storage.from(RESOURCE_BUCKET).remove([resource.storage_path]);
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
      return { ok: true };
    }),
  );

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

/** Short-lived download link for an attachment. */
export const resourceDownloadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: string }) => {
    if (!data?.id) throw new Error("Missing resource");
    return data;
  })
  .handler(
    guarded("resourceDownloadUrl", "preparing that download", async ({ data, context }) => {
      const { adminDb } = await import("@/lib/blex.server");
      const db = adminDb();
      const { data: row, error } = await db
        .from("project_resources")
        .select("id, quote_id, storage_path, archived_at")
        .eq("id", data.id)
        .maybeSingle();
      if (error) throw new Error(missingTable(error.message) ? notSetUp : error.message);
      const resource = row as unknown as Pick<
        ResourceRecord,
        "quote_id" | "storage_path" | "archived_at"
      > | null;
      if (!resource?.storage_path) throw new Error("That resource has no attachment.");

      await assertProjectAccess(context.supabase, resource.quote_id);
      const admin = await isAdminViewer(context.supabase, context.userId);
      if (resource.archived_at && !admin) throw new Error("That resource is no longer available.");

      const signed = await db.storage
        .from(RESOURCE_BUCKET)
        .createSignedUrl(resource.storage_path, 120);
      if (signed.error || !signed.data) throw new Error("We couldn't prepare that download.");
      return { url: signed.data.signedUrl };
    }),
  );
