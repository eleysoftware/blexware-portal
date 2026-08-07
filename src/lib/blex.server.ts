// Server-only helpers for the BLEXware quote pipeline.
// The generated Database type has no tables yet (schema was applied outside the
// migration tool), so the admin client is used untyped here on purpose.
import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const QUOTE_BUCKET = "quote-uploads";

export function adminDb(): SupabaseClient {
  return supabaseAdmin as unknown as SupabaseClient;
}

export async function requireAdmin(
  supabase: unknown,
  userId: string,
): Promise<void> {
  const client = supabase as SupabaseClient;
  const { data, error } = await client.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error) throw new Error("Could not verify permissions");
  if (data !== true) throw new Error("Forbidden: admin access required");
}

export async function writeAudit(entry: {
  actorId?: string | null;
  actorLabel?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const { error } = await adminDb()
    .from("audit_log")
    .insert({
      actor_id: entry.actorId ?? null,
      actor_label: entry.actorLabel ?? null,
      action: entry.action,
      entity: entry.entity,
      entity_id: entry.entityId ?? null,
      metadata: entry.metadata ?? {},
    });
  if (error) console.error("[audit]", error.message);
}

const PDF_HEADER = "%PDF-";
const FORBIDDEN_TOKENS = ["/JavaScript", "/JS", "/Launch", "/EmbeddedFile"];

/** Structural PDF validation. Not a virus scan — see the malware-scan hook below. */
export function validatePdf(bytes: Uint8Array, name: string): string | null {
  const head = new TextDecoder("latin1").decode(bytes.slice(0, 1024));
  if (!head.startsWith(PDF_HEADER)) {
    return `${name} is not a valid PDF file.`;
  }

  const body = new TextDecoder("latin1").decode(bytes);
  if (body.includes("/Encrypt")) {
    return `${name} is password-protected. Please upload an unprotected PDF.`;
  }
  for (const token of FORBIDDEN_TOKENS) {
    if (body.includes(token)) {
      return `${name} contains active content (${token}) and was rejected.`;
    }
  }
  return null;
}

/**
 * Malware-scan hook. Structural validation above is what we can do in-platform;
 * wire a provider (VirusTotal, ClamAV API) here when one is chosen.
 */
export async function scanForMalware(_bytes: Uint8Array): Promise<"skipped"> {
  return "skipped";
}
