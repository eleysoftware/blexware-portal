import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { EstimateLineItem } from "@/lib/documents/types";

export type EstimateInput = {
  quoteId: string;
  lineItems: EstimateLineItem[];
  discountCents: number;
  discountLabel?: string;
  durationNote?: string;
};

/** Everything downstream of the quote: proposal, estimate, SOW, invoices. */
export const getEngagement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { quoteId: string }) => data)
  .handler(async ({ data, context }) => {
    const { requireAdmin, adminDb } = await import("@/lib/blex.server");
    await requireAdmin(context.supabase, context.userId);
    const db = adminDb();

    const [proposals, estimates, agreements, invoices, documents, versions] = await Promise.all([
      db.from("proposals").select("*").eq("quote_id", data.quoteId).order("created_at", { ascending: false }),
      db.from("estimates").select("*").eq("quote_id", data.quoteId).order("created_at", { ascending: false }),
      db.from("agreements").select("*").eq("quote_id", data.quoteId).order("created_at", { ascending: false }),
      db.from("invoices").select("*").eq("quote_id", data.quoteId).order("sequence"),
      db
        .from("documents")
        .select("id, entity, entity_id, kind, format, created_at")
        .eq("quote_id", data.quoteId)
        .order("created_at", { ascending: false }),
      db
        .from("proposal_versions")
        .select("id, proposal_id, version, change_request, created_at")
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    const invoiceIds = (invoices.data ?? []).map((invoice) => invoice.id as string);
    const { data: payments } = invoiceIds.length
      ? await db
          .from("invoice_payments")
          .select("*")
          .in("invoice_id", invoiceIds)
          .order("created_at", { ascending: false })
      : { data: [] };

    const paymentIds = (payments ?? []).map((payment) => payment.id as string);
    const { data: refunds } = paymentIds.length
      ? await db
          .from("refunds")
          .select("*")
          .in("invoice_payment_id", paymentIds)
          .order("created_at", { ascending: false })
      : { data: [] };

    return {
      proposals: proposals.data ?? [],
      estimates: estimates.data ?? [],
      agreements: agreements.data ?? [],
      invoices: invoices.data ?? [],
      payments: payments ?? [],
      refunds: refunds ?? [],
      documents: documents.data ?? [],
      versions: versions.data ?? [],
    };
  });

/** Re-runs the AI draft with the client's requested changes, keeping history. */
export const regenerateProposal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { proposalId: string; changeRequest: string }) => {
    if (!data.changeRequest.trim()) throw new Error("Describe the changes to make");
    return { ...data, changeRequest: data.changeRequest.slice(0, 4000) };
  })
  .handler(async ({ data, context }) => {
    const { requireAdmin, adminDb, writeAudit } = await import("@/lib/blex.server");
    await requireAdmin(context.supabase, context.userId);
    const db = adminDb();

    const { data: proposal } = await db
      .from("proposals")
      .select("id, quote_id, content, doc, version, prompt")
      .eq("id", data.proposalId)
      .maybeSingle();
    if (!proposal) throw new Error("Proposal not found");

    await db.from("proposal_versions").insert({
      proposal_id: proposal.id,
      version: (proposal.version as number) ?? 1,
      content: proposal.content,
      doc: proposal.doc,
      change_request: data.changeRequest,
    });

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured for this project yet.");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You revise software project proposals for BLEXware. Return the complete revised proposal in markdown using H2 sections. Apply the requested changes faithfully, keep everything else intact, never invent pricing or compliance claims.",
          },
          {
            role: "user",
            content: `Current proposal:\n\n${proposal.content}\n\nRequested changes:\n${data.changeRequest}`,
          },
        ],
      }),
    });
    if (response.status === 429) throw new Error("AI rate limit reached. Try again shortly.");
    if (!response.ok) throw new Error("The revised proposal could not be generated.");

    const payload = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const content = payload.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error("The AI returned an empty revision.");

    await db
      .from("proposals")
      .update({
        content,
        doc: null,
        status: "draft",
        version: ((proposal.version as number) ?? 1) + 1,
        responded_at: null,
        client_response_note: null,
      })
      .eq("id", proposal.id);

    await writeAudit({
      actorId: context.userId,
      action: "proposal.regenerated",
      entity: "quote",
      entityId: proposal.quote_id as string,
      metadata: { version: ((proposal.version as number) ?? 1) + 1 },
    });

    return { ok: true };
  });

/** Creates or replaces the draft cost + schedule estimate for an approved proposal. */
export const saveEstimate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: EstimateInput) => {
    if (!data.lineItems?.length) throw new Error("Add at least one line item");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { requireAdmin, adminDb, writeAudit } = await import("@/lib/blex.server");
    await requireAdmin(context.supabase, context.userId);
    const { calculateTotals, buildEstimateDoc, buildProposalDocFromMarkdown } = await import(
      "@/lib/documents/compose"
    );
    const db = adminDb();

    const { data: quote } = await db.from("quotes").select("*").eq("id", data.quoteId).maybeSingle();
    if (!quote) throw new Error("Quote not found");

    const { data: proposal } = await db
      .from("proposals")
      .select("id, content, doc")
      .eq("quote_id", data.quoteId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const baseDoc =
      (proposal?.doc as ReturnType<typeof buildProposalDocFromMarkdown> | null) ??
      buildProposalDocFromMarkdown({
        markdown: (proposal?.content as string) ?? "",
        clientName: quote.contact_name as string,
        clientCompany: (quote.company as string | null) ?? null,
        clientEmail: quote.contact_email as string,
        clientPhone: (quote.phone as string | null) ?? null,
        projectType: quote.project_type as string,
        quoteNumber: quote.quote_number as string,
      });

    const totals = calculateTotals(data.lineItems, data.discountCents ?? 0);
    const doc = buildEstimateDoc(baseDoc, {
      lineItems: data.lineItems,
      ...totals,
      ...(data.discountLabel ? { discountLabel: data.discountLabel } : {}),
      ...(data.durationNote ? { durationNote: data.durationNote } : {}),
    });

    const { data: existing } = await db
      .from("estimates")
      .select("id, status")
      .eq("quote_id", data.quoteId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const row = {
      quote_id: data.quoteId,
      proposal_id: proposal?.id ?? null,
      status: "draft",
      doc,
      line_items: data.lineItems,
      subtotal_cents: totals.subtotalCents,
      discount_cents: totals.discountCents,
      total_cents: totals.totalCents,
      duration_note: data.durationNote ?? null,
    };

    let estimateId: string;
    if (existing && existing.status === "draft") {
      await db.from("estimates").update(row).eq("id", existing.id);
      estimateId = existing.id as string;
    } else {
      const { data: inserted, error } = await db.from("estimates").insert(row).select("id").single();
      if (error) throw new Error(error.message);
      estimateId = inserted.id as string;
    }

    await db.from("quotes").update({ status: "estimate_draft" }).eq("id", data.quoteId);
    await writeAudit({
      actorId: context.userId,
      action: "estimate.saved",
      entity: "quote",
      entityId: data.quoteId,
      metadata: { total_cents: totals.totalCents },
    });

    return { estimateId, totals };
  });

export const sendEstimate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { estimateId: string }) => data)
  .handler(async ({ data, context }) => {
    const { requireAdmin, adminDb, writeAudit } = await import("@/lib/blex.server");
    await requireAdmin(context.supabase, context.userId);
    const { storeDocument, emailEstimateSent, siteUrl } = await import("@/lib/engagement.server");
    const db = adminDb();

    const { data: estimate } = await db
      .from("estimates")
      .select("id, quote_id, doc, total_cents")
      .eq("id", data.estimateId)
      .maybeSingle();
    if (!estimate) throw new Error("Estimate not found");

    const { data: quote } = await db
      .from("quotes")
      .select("id, quote_number, contact_name, contact_email")
      .eq("id", estimate.quote_id)
      .single();
    if (!quote) throw new Error("Quote not found");


    await storeDocument({
      quoteId: estimate.quote_id as string,
      entity: "estimate",
      entityId: estimate.id as string,
      kind: "estimate",
      doc: estimate.doc as never,
      slug: quote.quote_number as string,
    });

    await db
      .from("estimates")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", estimate.id);
    await db.from("quotes").update({ status: "estimate_sent" }).eq("id", estimate.quote_id);

    const result = await emailEstimateSent({
      to: quote.contact_email as string,
      name: quote.contact_name as string,
      quoteNumber: quote.quote_number as string,
      url: `${siteUrl()}/portal/quotes/${estimate.quote_id as string}`,
      totalCents: Number(estimate.total_cents),
    });

    await writeAudit({
      actorId: context.userId,
      action: "estimate.sent",
      entity: "quote",
      entityId: estimate.quote_id as string,
      metadata: { emailed: result.sent },
    });

    return { emailed: result.sent };
  });

/** Turns an approved estimate into a SOW agreement and sends it for signature. */
export const createAgreement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { estimateId: string }) => data)
  .handler(async ({ data, context }) => {
    const { requireAdmin, adminDb, writeAudit } = await import("@/lib/blex.server");
    await requireAdmin(context.supabase, context.userId);
    const { buildSowDoc } = await import("@/lib/documents/compose");
    const { storeDocument, emailAgreementSent, siteUrl } = await import("@/lib/engagement.server");
    const db = adminDb();

    const { data: estimate } = await db
      .from("estimates")
      .select("id, quote_id, doc, total_cents, status")
      .eq("id", data.estimateId)
      .maybeSingle();
    if (!estimate) throw new Error("Estimate not found");
    if (estimate.status !== "approved") throw new Error("The client has not approved this estimate yet.");

    const { data: quote } = await db
      .from("quotes")
      .select("id, quote_number, contact_name, contact_email")
      .eq("id", estimate.quote_id)
      .single();
    if (!quote) throw new Error("Quote not found");


    const { data: agreement, error } = await db
      .from("agreements")
      .insert({
        quote_id: estimate.quote_id,
        estimate_id: estimate.id,
        total_cents: estimate.total_cents,
        status: "draft",
        doc: {},
      })
      .select("id, agreement_number")
      .single();
    if (error) throw new Error(error.message);

    const doc = buildSowDoc(estimate.doc as never, {
      agreementNumber: agreement.agreement_number as string,
      totalCents: Number(estimate.total_cents),
    });

    await storeDocument({
      quoteId: estimate.quote_id as string,
      entity: "agreement",
      entityId: agreement.id as string,
      kind: "sow",
      doc,
      slug: agreement.agreement_number as string,
    });

    await db
      .from("agreements")
      .update({ doc, status: "sent", sent_at: new Date().toISOString() })
      .eq("id", agreement.id);
    await db.from("quotes").update({ status: "contract_sent" }).eq("id", estimate.quote_id);

    const result = await emailAgreementSent({
      to: quote.contact_email as string,
      name: quote.contact_name as string,
      agreementNumber: agreement.agreement_number as string,
      url: `${siteUrl()}/portal/quotes/${estimate.quote_id as string}`,
    });

    await writeAudit({
      actorId: context.userId,
      action: "agreement.sent",
      entity: "quote",
      entityId: estimate.quote_id as string,
      metadata: { agreement: agreement.agreement_number, emailed: result.sent },
    });

    return { agreementId: agreement.id as string, emailed: result.sent };
  });

export const getDocumentUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { documentId: string }) => data)
  .handler(async ({ data, context }) => {
    const { requireAdmin, adminDb } = await import("@/lib/blex.server");
    await requireAdmin(context.supabase, context.userId);
    const { signedDocumentUrl } = await import("@/lib/engagement.server");

    const { data: doc } = await adminDb()
      .from("documents")
      .select("storage_path")
      .eq("id", data.documentId)
      .maybeSingle();
    if (!doc) throw new Error("Document not found");
    return { url: await signedDocumentUrl(doc.storage_path as string) };
  });

/** Sends (or resends) the next scheduled invoice immediately. */
export const sendInvoiceNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { invoiceId: string }) => data)
  .handler(async ({ data, context }) => {
    const { requireAdmin } = await import("@/lib/blex.server");
    await requireAdmin(context.supabase, context.userId);
    const { dispatchInvoice } = await import("@/lib/invoicing.server");
    const result = await dispatchInvoice(data.invoiceId);
    return result;
  });

/** Seeds the live Build Financial Wellness engagement at the estimate stage. */
export const seedWellnessProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Record<string, never>) => data ?? {})
  .handler(async ({ context }) => {
    const { requireAdmin, adminDb, writeAudit } = await import("@/lib/blex.server");
    await requireAdmin(context.supabase, context.userId);
    const { seedBuildFinancialWellness } = await import("@/lib/seed-wellness.server");
    const result = await seedBuildFinancialWellness();
    await writeAudit({
      actorId: context.userId,
      action: "seed.build_financial_wellness",
      entity: "quote",
      entityId: result.quoteId,
    });
    return result;
  });
