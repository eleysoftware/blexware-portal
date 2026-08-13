import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ProposalRecord, QuoteFileRecord, QuoteRecord } from "@/lib/quote-schema";

/**
 * Client-portal reads. Every query runs through the caller's own Supabase
 * client, so the RLS policies in 003_client_role.sql are the boundary — the
 * service role is only used to mint short-lived download URLs after the row
 * has already been proven visible to the caller.
 */
export const listMyQuotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Record<string, never>) => data ?? {})
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("quotes")
      .select(
        "id, quote_number, status, project_type, industry, budget, timeline, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw new Error(error.message);
    return { quotes: (data ?? []) as unknown as Partial<QuoteRecord>[] };
  });

export const getMyQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => {
    if (!/^[0-9a-f-]{36}$/i.test(data.id)) throw new Error("Unknown quote");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { data: quote, error } = await context.supabase
      .from("quotes")
      .select(
        "id, quote_number, status, project_type, industry, services, goals, features, budget, timeline, contact_name, contact_email, company, created_at",
      )
      .eq("id", data.id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!quote) return { quote: null, files: [], proposal: null };

    const { data: files } = await context.supabase
      .from("quote_files")
      .select("id, original_name, byte_size, mime_type, created_at")
      .eq("quote_id", data.id);

    const { data: proposal } = await context.supabase
      .from("proposals")
      .select("id, status, content, sent_at, responded_at, client_response_note, review_token")
      .eq("quote_id", data.id)
      .neq("status", "draft")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return {
      quote: quote as unknown as Partial<QuoteRecord>,
      files: (files ?? []) as unknown as QuoteFileRecord[],
      proposal: (proposal ?? null) as unknown as Pick<
        ProposalRecord,
        | "id"
        | "status"
        | "content"
        | "sent_at"
        | "responded_at"
        | "client_response_note"
        | "review_token"
      > | null,
    };
  });

export const getMyQuoteFileUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { fileId: string }) => {
    if (!/^[0-9a-f-]{36}$/i.test(data.fileId)) throw new Error("Unknown file");
    return data;
  })
  .handler(async ({ data, context }) => {
    // RLS decides visibility here; if the row comes back the caller owns it.
    const { data: file } = await context.supabase
      .from("quote_files")
      .select("id, storage_path, original_name")
      .eq("id", data.fileId)
      .maybeSingle();

    if (!file) throw new Error("File not found");

    const { adminDb, QUOTE_BUCKET } = await import("@/lib/blex.server");
    const { data: signed, error } = await adminDb()
      .storage.from(QUOTE_BUCKET)
      .createSignedUrl((file as { storage_path: string }).storage_path, 60);

    if (error || !signed) throw new Error("Could not prepare that download");
    return { url: signed.signedUrl, name: (file as { original_name: string }).original_name };
  });
