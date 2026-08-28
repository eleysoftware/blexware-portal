import { createServerFn } from "@tanstack/react-start";
import { guarded } from "@/lib/errors";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type {
  ProposalRecord,
  QuoteFileRecord,
  QuoteRecord,
  QuoteStatus,
} from "@/lib/quote-schema";
import { quoteStatuses } from "@/lib/quote-schema";
import type { ProjectDocument } from "@/lib/documents/types";

type AdminDb = ReturnType<(typeof import("@/lib/blex.server"))["adminDb"]>;

type ProposalPersistRow = {
  id: string;
  quote_id: string;
  content: string | null;
  doc: unknown;
  model: string | null;
};

type QuotePartyRow = {
  quote_number: string;
  contact_name: string;
  contact_email: string;
  project_type: string;
  company?: string | null;
  phone?: string | null;
};

async function proposalFileFormats(db: AdminDb, proposalId: string) {
  const { data } = await db
    .from("documents")
    .select("format")
    .eq("entity", "proposal")
    .eq("entity_id", proposalId);
  return new Set((data ?? []).map((row: { format: string }) => row.format));
}

async function storeProposalFiles(
  quoteId: string,
  proposalId: string,
  quoteNumber: string,
  doc: ProjectDocument,
) {
   const { storeDocument } = await import("@/lib/document-storage.server");
  return storeDocument({
    quoteId,
    entity: "proposal",
    entityId: proposalId,
    kind: "proposal",
    doc,
    slug: quoteNumber,
  });
}

async function persistProposalDocument(
  db: AdminDb,
  proposal: ProposalPersistRow,
  quote: QuotePartyRow,
  options: { storeFiles: boolean; onlyIfFilesMissing?: boolean },
) {
  const {
    shouldRebuildProposalDoc,
    composeProposalDocFromQuote,
    hasStructuredProposalDoc,
  } = await import("@/lib/documents/proposal");

  let doc = hasStructuredProposalDoc(proposal.doc) ? proposal.doc : null;
  if (shouldRebuildProposalDoc(proposal.model, proposal.doc)) {
    doc = composeProposalDocFromQuote(
      {
        contact_name: quote.contact_name,
        company: quote.company ?? null,
        contact_email: quote.contact_email,
        phone: quote.phone ?? null,
        project_type: quote.project_type,
        quote_number: quote.quote_number,
      },
      proposal.content ?? "",
    );
    const { error } = await db.from("proposals").update({ doc }).eq("id", proposal.id);
    if (error) throw new Error(error.message);
  }
  if (!doc) throw new Error("Proposal has no formatted document");

  if (options.storeFiles) {
    if (options.onlyIfFilesMissing) {
      const formats = await proposalFileFormats(db, proposal.id);
      if (formats.has("pdf") && formats.has("docx")) return doc;
    }
    await storeProposalFiles(proposal.quote_id, proposal.id, quote.quote_number, doc);
  }
  return doc;
}

export const listQuotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { status?: string; search?: string }) => data ?? {})
  .handler(
    guarded("listQuotes", "loading quotes", async ({ data, context }) => {
      const { requireAdmin, adminDb } = await import("@/lib/blex.server");
      await requireAdmin(context.supabase, context.userId);
      const archived = data.status === "archived";

      let query = adminDb()
        .from("quotes")
        .select(
          "id, quote_number, status, project_type, industry, budget, timeline, contact_name, contact_email, company, created_at, deleted_at",
        )
        .order("created_at", { ascending: false })
        .limit(200);

      query = archived ? query.not("deleted_at", "is", null) : query.is("deleted_at", null);

      if (data.status && data.status !== "all" && !archived) query = query.eq("status", data.status);
      if (data.search?.trim()) {
        const term = `%${data.search.trim()}%`;
        query = query.or(
          `quote_number.ilike.${term},contact_name.ilike.${term},contact_email.ilike.${term},company.ilike.${term}`,
        );
      }

      const { data: rows, error } = await query;
      if (error) throw new Error(error.message);

      const counts: Record<string, number> = {};
      for (const status of quoteStatuses) counts[status] = 0;
      const { data: all } = await adminDb()
        .from("quotes")
        .select("status")
        .is("deleted_at", null);
      for (const row of (all ?? []) as { status: string }[]) {
        counts[row.status] = (counts[row.status] ?? 0) + 1;
      }

      const { count: archivedCount } = await adminDb()
        .from("quotes")
        .select("id", { count: "exact", head: true })
        .not("deleted_at", "is", null);
      counts["archived"] = archivedCount ?? 0;

      return { quotes: (rows ?? []) as Partial<QuoteRecord>[], counts };
    }),
  );

/** Soft-archives a quote so it drops out of the working queue (reversible). */
export const archiveQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: string; archived: boolean }) => data)
  .handler(
    guarded("archiveQuote", "archiving the quote", async ({ data, context }) => {
      const { requireAdmin, adminDb, writeAudit } = await import("@/lib/blex.server");
      await requireAdmin(context.supabase, context.userId);

      const { error } = await adminDb()
        .from("quotes")
        .update({ deleted_at: data.archived ? new Date().toISOString() : null })
        .eq("id", data.id);
      if (error) throw new Error(error.message);

      await writeAudit({
        actorId: context.userId,
        actorLabel: String(context.claims["email"] ?? context.userId),
        action: data.archived ? "quote.archived" : "quote.restored",
        entity: "quote",
        entityId: data.id,
      });
      return { ok: true, archived: data.archived };
    }),
  );

/**
 * Permanently removes an archived quote and everything attached to it.
 * Blocked when the engagement has legal/financial records worth keeping.
 */
export const deleteQuotePermanently = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: string; confirmQuoteNumber: string }) => data)
  .handler(
    guarded("deleteQuotePermanently", "deleting the quote", async ({ data, context }) => {
      const { requireAdmin, adminDb, writeAudit, QUOTE_BUCKET, DOCUMENT_BUCKET } = await import(
        "@/lib/blex.server"
      );
      await requireAdmin(context.supabase, context.userId);
      const db = adminDb();

      const { data: quote } = await db
        .from("quotes")
        .select("id, quote_number, deleted_at")
        .eq("id", data.id)
        .maybeSingle();
      if (!quote) throw new Error("Quote not found");
      if (!quote.deleted_at) throw new Error("Archive this quote before deleting it");
      if (
        data.confirmQuoteNumber.trim().toLowerCase() !== String(quote.quote_number).toLowerCase()
      ) {
        throw new Error("The quote number you typed doesn't match");
      }

      const { data: signed } = await db
        .from("agreements")
        .select("id")
        .eq("quote_id", data.id)
        .eq("status", "signed")
        .limit(1);
      if (signed?.length) {
        throw new Error(
          "This project has a signed Statement of Work, so it has to be kept. It stays archived instead.",
        );
      }

      const { data: issued } = await db
        .from("invoices")
        .select("id")
        .eq("quote_id", data.id)
        .not("status", "in", "(draft,scheduled,void,cancelled)")
        .limit(1);
      if (issued?.length) {
        throw new Error(
          "This project has issued invoices, so it has to be kept for your records. It stays archived instead.",
        );
      }

      const { data: uploads } = await db
        .from("quote_files")
        .select("storage_path")
        .eq("quote_id", data.id);
      const uploadPaths = (uploads ?? []).map((row: { storage_path: string }) => row.storage_path);
      if (uploadPaths.length) await db.storage.from(QUOTE_BUCKET).remove(uploadPaths);

      const { data: docs } = await db
        .from("documents")
        .select("storage_path")
        .eq("quote_id", data.id);
      const docPaths = (docs ?? []).map((row: { storage_path: string }) => row.storage_path);
      if (docPaths.length) await db.storage.from(DOCUMENT_BUCKET).remove(docPaths);

      const { data: agreements } = await db.from("agreements").select("id").eq("quote_id", data.id);
      const { data: invoices } = await db.from("invoices").select("id").eq("quote_id", data.id);
      const invoiceIds = (invoices ?? []).map((row: { id: string }) => row.id);
      if (invoiceIds.length) {
        const { data: attempts } = await db
          .from("invoice_payments")
          .select("id")
          .in("invoice_id", invoiceIds);
        const attemptIds = (attempts ?? []).map((row: { id: string }) => row.id);
        if (attemptIds.length) {
          await db.from("refunds").delete().in("invoice_payment_id", attemptIds);
          await db.from("payment_events").delete().in("invoice_payment_id", attemptIds);
        }
        await db.from("invoice_payments").delete().in("invoice_id", invoiceIds);
        await db.from("payments").delete().in("invoice_id", invoiceIds);
      }
      await db.from("invoices").delete().eq("quote_id", data.id);
      if (agreements?.length) await db.from("agreements").delete().eq("quote_id", data.id);

      const { data: proposals } = await db.from("proposals").select("id").eq("quote_id", data.id);
      const proposalIds = (proposals ?? []).map((row: { id: string }) => row.id);
      if (proposalIds.length) {
        await db.from("proposal_versions").delete().in("proposal_id", proposalIds);
      }
      await db.from("estimates").delete().eq("quote_id", data.id);
      await db.from("proposals").delete().eq("quote_id", data.id);
      await db.from("documents").delete().eq("quote_id", data.id);
      await db.from("quote_files").delete().eq("quote_id", data.id);

      const { error } = await db.from("quotes").delete().eq("id", data.id);
      if (error) throw new Error(error.message);

      await writeAudit({
        actorId: context.userId,
        actorLabel: String(context.claims["email"] ?? context.userId),
        action: "quote.deleted",
        entity: "quote",
        entityId: data.id,
        metadata: { quoteNumber: quote.quote_number },
      });

      return { ok: true };
    }),
  );


export const getQuoteDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: string }) => data)
  .handler(
    guarded("getQuoteDetail", "loading the quote", async ({ data, context }) => {
      const { requireAdmin, adminDb } = await import("@/lib/blex.server");
      await requireAdmin(context.supabase, context.userId);
      const db = adminDb();

      const { data: quote, error } = await db
        .from("quotes")
        .select("*")
        .eq("id", data.id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!quote) throw new Error("Quote not found");

      const { data: files } = await db
        .from("quote_files")
        .select("id, original_name, byte_size, mime_type, created_at")
        .eq("quote_id", data.id)
        .order("created_at");

      const { data: proposals } = await db
        .from("proposals")
        .select("id, status, content, review_token, sent_at, client_response_note, created_at, doc, model")
        .eq("quote_id", data.id)
        .order("created_at", { ascending: false });

      const { data: documents } = await db
        .from("documents")
        .select("id, entity, entity_id, kind, format, created_at")
        .eq("quote_id", data.id)
        .order("created_at", { ascending: false });

      const { data: audit } = await db
        .from("audit_log")
        .select("id, action, actor_label, created_at, metadata")
        .eq("entity_id", data.id)
        .order("created_at", { ascending: false })
        .limit(30);

      return {
        quote: quote as QuoteRecord,
        files: (files ?? []) as QuoteFileRecord[],
        proposals: (proposals ?? []) as ProposalRecord[],
        documents: (documents ?? []) as {
          id: string;
          entity: string;
          entity_id: string;
          kind: string;
          format: string;
          created_at: string;
        }[],
        audit: (audit ?? []) as {
          id: string;
          action: string;
          actor_label: string | null;
          created_at: string;
        }[],
      };
    }),
  );

export const updateQuoteStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: string; status: QuoteStatus }) => {
    if (!quoteStatuses.includes(data.status)) throw new Error("Unknown status");
    return data;
  })
  .handler(
    guarded("updateQuoteStatus", "updating the quote", async ({ data, context }) => {
      const { requireAdmin, adminDb, writeAudit } = await import("@/lib/blex.server");
      await requireAdmin(context.supabase, context.userId);

      const { error } = await adminDb()
        .from("quotes")
        .update({ status: data.status })
        .eq("id", data.id);
      if (error) throw new Error(error.message);

      await writeAudit({
        actorId: context.userId,
        actorLabel: String(context.claims['email'] ?? context.userId),
        action: "quote.status_changed",
        entity: "quote",
        entityId: data.id,
        metadata: { status: data.status },
      });
      return { ok: true };
    }),
  );

export const getQuoteFileUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { fileId: string }) => data)
  .handler(
    guarded("getQuoteFileUrl", "preparing the download", async ({ data, context }) => {
      const { requireAdmin, adminDb, writeAudit, QUOTE_BUCKET } = await import(
        "@/lib/blex.server"
      );
      await requireAdmin(context.supabase, context.userId);
      const db = adminDb();

      const { data: file } = await db
        .from("quote_files")
        .select("storage_path, quote_id, original_name")
        .eq("id", data.fileId)
        .maybeSingle();
      if (!file) throw new Error("File not found");

      const { data: signed, error } = await db.storage
        .from(QUOTE_BUCKET)
        .createSignedUrl(file.storage_path as string, 120);
      if (error || !signed) throw new Error("Could not create download link");

      await writeAudit({
        actorId: context.userId,
        actorLabel: String(context.claims['email'] ?? context.userId),
        action: "quote_file.downloaded",
        entity: "quote",
        entityId: file.quote_id as string,
        metadata: { file: file.original_name },
      });

      return { url: signed.signedUrl as string };
    }),
  );

export const generateProposal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { quoteId: string; provider?: string; model?: string }) => data)
  .handler(
    guarded("generateProposal", "generating the proposal", async ({ data, context }) => {
      const { requireAdmin, adminDb, writeAudit } = await import("@/lib/blex.server");
      await requireAdmin(context.supabase, context.userId);
      const db = adminDb();

      const { data: quote } = await db
        .from("quotes")
        .select("*")
        .eq("id", data.quoteId)
        .maybeSingle();
      if (!quote) throw new Error("Quote not found");

      const prompt = [
        `Prospect: ${quote.contact_name}${quote.company ? ` (${quote.company})` : ""}`,
        `Industry: ${quote.industry}`,
        `Project type: ${quote.project_type}`,
        `Services requested: ${(quote.services as string[] | null)?.join(", ") ?? "n/a"}`,
        `Budget range: ${quote.budget}`,
        `Timeline: ${quote.timeline}`,
        `Goals: ${quote.goals}`,
        `Desired features: ${quote.features ?? "not specified"}`,
      ].join("\n");

      const { completeChat } = await import("@/lib/ai.server");
      const { content, model } = await completeChat([
        {
          role: "system",
          content:
            "You write software project proposals for BLEXware, a Black-led AI and custom software studio. Write in markdown with these H2 sections in order: Executive Summary, Business Goals, Functional Requirements, Technical Requirements, Architecture, Recommended Technology, Timeline, Phases, Deliverables, Optional Features, Discovery Questions. Be concrete and grounded in the intake answers. Never invent pricing beyond the stated budget range, and never invent certifications or compliance claims.",
        },
        { role: "user", content: prompt },
      ], { provider: data.provider, model: data.model });

      const { composeProposalDocFromQuote } = await import("@/lib/documents/proposal");
      const doc = composeProposalDocFromQuote(
        {
          contact_name: quote.contact_name as string,
          company: (quote.company as string | null) ?? null,
          contact_email: quote.contact_email as string,
          phone: (quote.phone as string | null) ?? null,
          project_type: quote.project_type as string,
          quote_number: quote.quote_number as string,
        },
        content,
      );

      const { data: proposal, error } = await db
        .from("proposals")
        .insert({ quote_id: data.quoteId, model, prompt, content, doc })
        .select("*")
        .single();
      if (error) throw new Error(error.message);

      await db.from("quotes").update({ status: "proposal_draft" }).eq("id", data.quoteId);
      await writeAudit({
        actorId: context.userId,
        actorLabel: String(context.claims['email'] ?? context.userId),
        action: "proposal.draft_generated",
        entity: "quote",
        entityId: data.quoteId,
        metadata: { model },
      });

      return { proposal: proposal as ProposalRecord };
    }),
  );

export const saveProposal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: string; content: string; documentTitle?: string }) => data)
  .handler(
    guarded("saveProposal", "saving the proposal", async ({ data, context }) => {
      const { requireAdmin, adminDb, writeAudit } = await import("@/lib/blex.server");
      await requireAdmin(context.supabase, context.userId);
      const db = adminDb();

      const { data: existing } = await db
        .from("proposals")
        .select("model, doc, quote_id")
        .eq("id", data.id)
        .single();
      if (!existing) throw new Error("Proposal not found");

      const { data: quote } = await db
        .from("quotes")
        .select("contact_name, company, contact_email, phone, project_type, quote_number")
        .eq("id", existing.quote_id)
        .single();

      const { isImportedProposal, composeProposalDocFromQuote } = await import("@/lib/documents/proposal");
      let doc = existing.doc as import("@/lib/documents/types").ProjectDocument | null;
      if (isImportedProposal(existing.model as string) && doc) {
        if (data.documentTitle?.trim()) doc = { ...doc, documentTitle: data.documentTitle.trim() };
      } else if (quote) {
        doc = composeProposalDocFromQuote(
          {
            contact_name: quote.contact_name as string,
            company: (quote.company as string | null) ?? null,
            contact_email: quote.contact_email as string,
            phone: (quote.phone as string | null) ?? null,
            project_type: quote.project_type as string,
            quote_number: quote.quote_number as string,
          },
          data.content,
          data.documentTitle,
        );
      }

      const { error } = await db.from("proposals").update({ content: data.content, doc }).eq("id", data.id);
      if (error) throw new Error(error.message);

      await writeAudit({
        actorId: context.userId,
        action: "proposal.edited",
        entity: "proposal",
        entityId: data.id,
      });
      return { ok: true };
    }),
  );

export const sendProposal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: string }) => data)
  .handler(
    guarded("sendProposal", "sending the proposal", async ({ data, context }) => {
      const { requireAdmin, adminDb, writeAudit } = await import("@/lib/blex.server");
      await requireAdmin(context.supabase, context.userId);
      const db = adminDb();

      const { data: proposal, error } = await db
        .from("proposals")
        .select("id, review_token, quote_id, content, doc, model")
        .eq("id", data.id)
        .single();
      if (error || !proposal) throw new Error(error?.message ?? "Proposal not found");

      const { data: quote, error: quoteError } = await db
        .from("quotes")
        .select("quote_number, contact_name, contact_email, project_type, company, phone")
        .eq("id", proposal.quote_id)
        .single();
      if (quoteError || !quote) throw new Error(quoteError?.message ?? "Quote not found");

      const contactEmail = String(quote.contact_email ?? "").trim();
      if (!contactEmail) throw new Error("This quote has no contact email");

      const { isImportedProposal } = await import("@/lib/documents/proposal");
      await persistProposalDocument(db, proposal as ProposalPersistRow, quote as QuotePartyRow, {
        storeFiles: true,
        onlyIfFilesMissing: isImportedProposal(proposal.model as string),
      });

      const reviewPath = `/proposal/${proposal.review_token as string}`;
      const { SITE_URL } = await import("@/content/site");
      const reviewUrl = `${SITE_URL}${reviewPath}`;

      const { sendEmail, renderEmail, requireEmailSent } = await import("@/lib/email.server");
      const rendered = renderEmail({
        heading: "Your BLEXware proposal is ready",
        paragraphs: [
          `Hi ${String(quote.contact_name ?? "there")},`,
          `We've prepared the proposal for ${String(quote.project_type || "your project")} (${String(quote.quote_number)}).`,
          "Open the secure review link below to read it and let us know whether you'd like to approve it, request changes, or decline.",
        ],
        cta: { label: "Review your proposal", url: reviewUrl },
        footnote: "This link is private to you — please don't forward it.",
      });
      requireEmailSent(
        await sendEmail({
          to: contactEmail,
          toName: String(quote.contact_name ?? ""),
          subject: `Your BLEXware proposal — ${String(quote.quote_number)}`,
          html: rendered.html,
          text: rendered.text,
        }),
      );

      const { error: updateError } = await db
        .from("proposals")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 5 * 86_400_000).toISOString(),
          reviewed_by: context.userId,
        })
        .eq("id", data.id);
      if (updateError) throw new Error(updateError.message);

      await db.from("quotes").update({ status: "proposal_sent" }).eq("id", proposal.quote_id);

      await writeAudit({
        actorId: context.userId,
        actorLabel: String(context.claims['email'] ?? context.userId),
        action: "proposal.sent",
        entity: "quote",
        entityId: proposal.quote_id as string,
        metadata: { emailed: true },
      });

      return { reviewPath, emailed: true };
    }),
  );

export const getAdminStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: Record<string, never>) => data)
  .handler(
    guarded("getAdminStatus", "checking your access", async ({ context }) => {
      const client = context.supabase as unknown as {
        rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }>;
      };
      const { data } = await client.rpc("has_role", {
        _user_id: context.userId,
        _role: "admin",
      });
      return { isAdmin: data === true, email: String(context.claims['email'] ?? "") };
    }),
  );

/** Whether an AI key is configured in this environment (used to disable AI actions in the UI). */
export const getAiStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: Record<string, never>) => data)
  .handler(
    guarded("getAiStatus", "checking AI availability", async () => {
      const { aiTargets, listAiModels } = await import("@/config/ai");
      const targets = aiTargets();
      const providers = await Promise.all(
        targets.map(async (target) => ({
          id: target.id,
          label: target.label,
          defaultModel: target.model,
          models: await listAiModels(target),
        })),
      );
      return { configured: providers.length > 0, providers };
    }),
  );

const UUID = /^[0-9a-f-]{36}$/i;

async function loadQuoteParty(db: AdminDb, quoteId: string) {
  const { data: quote, error } = await db
    .from("quotes")
    .select("quote_number, contact_name, contact_email, project_type, company, phone")
    .eq("id", quoteId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!quote) throw new Error("Quote not found");
  return quote as QuotePartyRow;
}

async function refreshLatestProposalForQuote(db: AdminDb, quoteId: string, onlyEmptyDoc: boolean) {
  const { data: proposal } = await db
    .from("proposals")
    .select("id, quote_id, content, doc, model")
    .eq("quote_id", quoteId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!proposal) return null;

  const { hasStructuredProposalDoc, isImportedProposal } = await import("@/lib/documents/proposal");
  if (onlyEmptyDoc) {
    if (isImportedProposal(proposal.model as string)) return null;
    if (hasStructuredProposalDoc(proposal.doc)) return null;
    if (!proposal.content) return null;
  }

  const quote = await loadQuoteParty(db, quoteId);
  const doc = await persistProposalDocument(db, proposal as ProposalPersistRow, quote, {
    storeFiles: true,
  });
  return { ...proposal, doc };
}

export const refreshProposalDocuments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { quoteId?: string } = {}) => {
    if (data.quoteId && !UUID.test(data.quoteId)) throw new Error("Unknown quote");
    return data;
  })
  .handler(
    guarded("refreshProposalDocuments", "refreshing the documents", async ({ data, context }) => {
      const { requireAdmin, adminDb, writeAudit } = await import("@/lib/blex.server");
      await requireAdmin(context.supabase, context.userId);
      const db = adminDb();

      if (data.quoteId) {
        const proposal = await refreshLatestProposalForQuote(db, data.quoteId, false);
        if (!proposal) throw new Error("No proposal found for this quote");
        await writeAudit({
          actorId: context.userId,
          actorLabel: String(context.claims["email"] ?? context.userId),
          action: "proposal.documents_refreshed",
          entity: "quote",
          entityId: data.quoteId,
        });
        return { converted: 1, proposal };
      }

      const { data: rows } = await db
        .from("proposals")
        .select("quote_id")
        .order("created_at", { ascending: false });

      const seen = new Set<string>();
      let converted = 0;
      for (const row of rows ?? []) {
        const quoteId = row.quote_id as string;
        if (seen.has(quoteId)) continue;
        seen.add(quoteId);
        const result = await refreshLatestProposalForQuote(db, quoteId, true);
        if (result) converted += 1;
      }

      await writeAudit({
        actorId: context.userId,
        actorLabel: String(context.claims["email"] ?? context.userId),
        action: "proposal.documents_converted",
        entity: "proposal",
        metadata: { converted },
      });

      return { converted };
    }),
  );
