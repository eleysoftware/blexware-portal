import { createServerFn } from "@tanstack/react-start";
import { guarded } from "@/lib/errors";
import type { SupabaseClient } from "@supabase/supabase-js";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ProposalRecord, QuoteFileRecord, QuoteRecord } from "@/lib/quote-schema";

function viewerDb(supabase: unknown): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}

/**
 * Client-portal reads. Every query runs through the caller's own Supabase
 * client, so the RLS policies in 003_client_role.sql are the boundary — the
 * service role is only used to mint short-lived download URLs after the row
 * has already been proven visible to the caller.
 */
export type QuoteBilling = {
  billedCents: number;
  paidCents: number;
  outstandingCents: number;
  payableCount: number;
  overdueCount: number;
};

export const listMyQuotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: Record<string, never>) => data ?? {})
  .handler(
    guarded("listMyQuotes", "loading your requests", async ({ context }) => {
      const { data, error } = await context.supabase
        .from("quotes")
        .select(
          "id, quote_number, status, project_type, industry, budget, timeline, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw new Error(error.message);
      const quotes = (data ?? []) as unknown as Partial<QuoteRecord>[];

      // The rows above are already RLS-proven to belong to the caller, so the
      // billing rollup can be aggregated with the service role over those ids.
      const ids = quotes.map((quote) => quote.id).filter(Boolean) as string[];
      const billing: Record<string, QuoteBilling> = {};
      let totalPaid = 0;
      let totalOutstanding = 0;

      if (ids.length) {
        const { adminDb } = await import("@/lib/blex.server");
        const { data: invoices } = await adminDb()
          .from("invoices")
          .select("quote_id, amount_cents, amount_paid_cents, status, due_date")
          .in("quote_id", ids)
          .not("status", "in", "(void,cancelled,draft)");

        const today = new Date().toISOString().slice(0, 10);
        for (const row of (invoices ?? []) as {
          quote_id: string;
          amount_cents: number;
          amount_paid_cents: number | null;
          status: string;
          due_date: string | null;
        }[]) {
          const bucket = (billing[row.quote_id] ??= {
            billedCents: 0,
            paidCents: 0,
            outstandingCents: 0,
            payableCount: 0,
            overdueCount: 0,
          });
          const amount = Number(row.amount_cents ?? 0);
          const paid = Number(row.amount_paid_cents ?? 0);
          const balance = Math.max(0, amount - paid);
          bucket.billedCents += amount;
          bucket.paidCents += paid;
          bucket.outstandingCents += balance;
          if (balance > 0 && row.status !== "scheduled") {
            bucket.payableCount += 1;
            if (row.due_date && row.due_date < today) bucket.overdueCount += 1;
          }
        }

        for (const bucket of Object.values(billing)) {
          totalPaid += bucket.paidCents;
          totalOutstanding += bucket.outstandingCents;
        }
      }

      return { quotes, billing, totals: { paidCents: totalPaid, outstandingCents: totalOutstanding } };
    }),
  );


export const getMyQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: string }) => {
    if (!/^[0-9a-f-]{36}$/i.test(data.id)) throw new Error("Unknown quote");
    return data;
  })
  .handler(
    guarded("getMyQuote", "loading your request", async ({ data, context }) => {
      const { data: quote, error } = await context.supabase
        .from("quotes")
        .select(
          "id, quote_number, status, project_type, industry, services, goals, features, budget, timeline, contact_name, contact_email, company, created_at",
        )
        .eq("id", data.id)
        .maybeSingle();

      if (error) throw new Error(error.message);
      if (!quote) return { quote: null, files: [], proposal: null, documents: [] };

      const { data: files } = await context.supabase
        .from("quote_files")
        .select("id, original_name, byte_size, mime_type, created_at")
        .eq("quote_id", data.id);

      const { data: proposal } = await context.supabase
        .from("proposals")
        .select("id, status, content, sent_at, responded_at, client_response_note, review_token, doc")
        .eq("quote_id", data.id)
        .neq("status", "draft")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const { data: documents } = proposal
        ? await viewerDb(context.supabase)
            .from("documents")
            .select("id, entity, entity_id, kind, format")
            .eq("quote_id", data.id)
            .eq("entity", "proposal")
            .eq("entity_id", (proposal as unknown as { id: string }).id)
            .order("created_at", { ascending: false })
        : { data: [] };

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
          | "doc"
        > | null,
        documents: (documents ?? []) as unknown as {
          id: string;
          entity: string;
          entity_id: string;
          kind: string;
          format: string;
        }[],
      };
    }),
  );

export const getMyQuoteFileUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { fileId: string }) => {
    if (!/^[0-9a-f-]{36}$/i.test(data.fileId)) throw new Error("Unknown file");
    return data;
  })
  .handler(
    guarded("getMyQuoteFileUrl", "preparing the download", async ({ data, context }) => {
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
    }),
  );
