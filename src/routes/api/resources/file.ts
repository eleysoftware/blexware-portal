import { createFileRoute } from "@tanstack/react-router";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import {
  safeAttachmentName,
  verifyResourceDeliveryToken,
} from "@/lib/resource-delivery";
import { normalizeAttachments, type ResourceAttachment } from "@/lib/resource-rules";

const querySchema = z.object({ token: z.string().min(20).max(8_000) });

export const Route = createFileRoute("/api/resources/file")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const parsed = querySchema.safeParse({ token: new URL(request.url).searchParams.get("token") });
        if (!parsed.success) return new Response("Invalid file link", { status: 400 });

        const secret = process.env["SUPABASE_SERVICE_ROLE_KEY"];
        if (!secret) return new Response("File delivery is unavailable", { status: 503 });
        const claims = await verifyResourceDeliveryToken(parsed.data.token, secret);
        if (!claims) return new Response("This file link has expired", { status: 401 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const db = supabaseAdmin as unknown as SupabaseClient;
        const withAttachments = await db
          .from("project_resources")
          .select("id, storage_path, original_name, mime_type, byte_size, attachments")
          .eq("id", claims.resourceId)
          .maybeSingle();
        const result =
          withAttachments.error && /attachments/i.test(withAttachments.error.message)
            ? await db
                .from("project_resources")
                .select("id, storage_path, original_name, mime_type, byte_size")
                .eq("id", claims.resourceId)
                .maybeSingle()
            : withAttachments;
        if (result.error || !result.data) return new Response("File not found", { status: 404 });

        const row = result.data as Record<string, unknown>;
        const attachments = normalizeAttachments(row["attachments"]);
        const legacyPath = typeof row["storage_path"] === "string" ? row["storage_path"] : null;
        const attachment =
          attachments.find((item) => item.path === claims.path) ??
          (legacyPath === claims.path
            ? ({
                path: legacyPath,
                name: typeof row["original_name"] === "string" ? row["original_name"] : "attachment",
                mime: typeof row["mime_type"] === "string" ? row["mime_type"] : "application/octet-stream",
                size: typeof row["byte_size"] === "number" ? row["byte_size"] : 0,
              } satisfies ResourceAttachment)
            : null);
        if (!attachment) return new Response("File not found", { status: 404 });

        const downloaded = await db.storage.from("project-resources").download(claims.path);
        if (downloaded.error || !downloaded.data) return new Response("File not found", { status: 404 });

        const name = safeAttachmentName(attachment.name);
        const disposition = claims.mode === "view" ? "inline" : "attachment";
        return new Response(downloaded.data.stream(), {
          headers: {
            "content-type": attachment.mime || "application/octet-stream",
            "content-disposition": `${disposition}; filename="${name}"; filename*=UTF-8''${encodeURIComponent(name)}`,
            "cache-control": "private, no-store, max-age=0",
            "x-content-type-options": "nosniff",
            "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
          },
        });
      },
    },
  },
});