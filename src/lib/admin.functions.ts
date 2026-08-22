import { createServerFn } from "@tanstack/react-start";

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
  const { storeDocument } = await import("@/lib/engagement.server");
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
  .handler(async ({ data, context }) => {
    const { requireAdmin, adminDb } = await import("@/lib/blex.server");
    await requireAdmin(context.supabase, context.userId);

    let query = adminDb()
      .from("quotes")
      .select(
        "id, quote_number, status, project_type, industry, budget, timeline, contact_name, contact_email, company, created_at",
      )
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(200);

    if (data.status && data.status !== "all") query = query.eq("status", data.status);
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

    return { quotes: (rows ?? []) as Partial<QuoteRecord>[], counts };
  });

export const getQuoteDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
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
  });

export const updateQuoteStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: string; status: QuoteStatus }) => {
    if (!quoteStatuses.includes(data.status)) throw new Error("Unknown status");
    return data;
  })
  .handler(async ({ data, context }) => {
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
  });

export const getQuoteFileUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { fileId: string }) => data)
  .handler(async ({ data, context }) => {
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
  });

export const generateProposal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { quoteId: string; provider?: string; model?: string }) => data)
  .handler(async ({ data, context }) => {
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
  });

export const saveProposal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: string; content: string; documentTitle?: string }) => data)
  .handler(async ({ data, context }) => {
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
  });

export const sendProposal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
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
  });

export const getAdminStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: Record<string, never>) => data)
  .handler(async ({ context }) => {
    const client = context.supabase as unknown as {
      rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }>;
    };
    const { data } = await client.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    return { isAdmin: data === true, email: String(context.claims['email'] ?? "") };
  });

/** Whether an AI key is configured in this environment (used to disable AI actions in the UI). */
export const getAiStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: Record<string, never>) => data)
  .handler(async () => {
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
  });

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
  .handler(async ({ data, context }) => {
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
  });
