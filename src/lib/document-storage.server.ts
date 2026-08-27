// Server-only document rendering, storage, and signed-download helpers.
// Keep this module out of status updates and notification-only request paths:
// importing it intentionally loads the PDF/DOCX rendering dependency graph.
import { documentsBucket } from "@/config/storage";
import { adminDb } from "@/lib/blex.server";
import type { ProjectDocument } from "@/lib/documents/types";

export const DOCUMENT_BUCKET = documentsBucket();

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as unknown as ArrayBuffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export type StoredDocument = { format: "pdf" | "docx"; path: string; sha256: string; size: number };

export async function storeDocument(input: {
  quoteId: string;
  entity: "proposal" | "estimate" | "agreement" | "invoice";
  entityId: string;
  kind: string;
  doc: ProjectDocument;
  slug: string;
}): Promise<StoredDocument[]> {
  const db = adminDb();
  const { renderPdf, renderDocx } = await import("@/lib/documents/render.server");
  const [pdf, docx] = await Promise.all([renderPdf(input.doc), renderDocx(input.doc)]);
  const stamp = Date.now();
  const files: { format: "pdf" | "docx"; bytes: Uint8Array; mime: string }[] = [
    { format: "pdf", bytes: pdf, mime: "application/pdf" },
    {
      format: "docx",
      bytes: docx,
      mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    },
  ];

  const stored: StoredDocument[] = [];
  for (const file of files) {
    const path = `${input.quoteId}/${input.entity}/${input.entityId}-${stamp}.${file.format}`;
    const upload = await db.storage
      .from(DOCUMENT_BUCKET)
      .upload(path, file.bytes, { contentType: file.mime, upsert: true });
    if (upload.error) {
      console.error("[documents:upload]", upload.error.message);
      continue;
    }
    const hash = await sha256Hex(file.bytes);
    await db.from("documents").insert({
      quote_id: input.quoteId,
      entity: input.entity,
      entity_id: input.entityId,
      kind: input.kind,
      format: file.format,
      storage_path: path,
      byte_size: file.bytes.byteLength,
      sha256: hash,
    });
    stored.push({ format: file.format, path, sha256: hash, size: file.bytes.byteLength });
  }
  return stored;
}

export async function signedDocumentUrl(path: string, seconds = 120): Promise<string> {
  const { data, error } = await adminDb().storage.from(DOCUMENT_BUCKET).createSignedUrl(path, seconds);
  if (error || !data) throw new Error("Could not prepare that download");
  return data.signedUrl;
}