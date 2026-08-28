import { createServerFn } from "@tanstack/react-start";
import { guarded } from "@/lib/errors";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { EstimateLineItem } from "@/lib/documents/types";

export type EstimateInput = {
  quoteId: string;
  lineItems: EstimateLineItem[];
  discountCents: number;
  discountLabel?: string;
  durationNote?: string;
  paymentKind?: import("@/lib/documents/types").PaymentPlanKind;
  customPayments?: { label: string; amountCents: number }[];
  documentTitle?: string;
  /** Explicit opt-in to supersede a client-approved estimate with a new draft. */
  revise?: boolean;
};

/** Everything downstream of the quote: proposal, estimate, SOW, invoices. */
export const getEngagement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { quoteId: string }) => data)
  .handler(
    guarded("getEngagement", "loading the engagement", async ({ data, context }) => {
      const { requireAdmin, adminDb } = await import("@/lib/blex.server");
      await requireAdmin(context.supabase, context.userId);
      const db = adminDb();

      const { ensureInvoiceScheduleForQuote, getProjectPaymentSummary, expireStaleAttempts } = await import("@/lib/invoicing.server");
      await ensureInvoiceScheduleForQuote(data.quoteId);
      await expireStaleAttempts(data.quoteId);


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
        projectPayment: await getProjectPaymentSummary(data.quoteId),
      };
    }),
  );

/** Re-runs the AI draft with the client's requested changes, keeping history. */
export const regenerateProposal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { proposalId: string; changeRequest: string; provider?: string; model?: string }) => {
    if (!data.changeRequest.trim()) throw new Error("Describe the changes to make");
    return { ...data, changeRequest: data.changeRequest.slice(0, 4000) };
  })
  .handler(
    guarded("regenerateProposal", "regenerating the proposal", async ({ data, context }) => {
      const { requireAdmin, adminDb, writeAudit } = await import("@/lib/blex.server");
      await requireAdmin(context.supabase, context.userId);
      const db = adminDb();

      const { data: proposal } = await db
        .from("proposals")
        .select("id, quote_id, content, doc, version, prompt, model")
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

      const { completeChat } = await import("@/lib/ai.server");
      const { content } = await completeChat([
        {
          role: "system",
          content:
            "You revise software project proposals for BLEXware. Return the complete revised proposal in markdown using H2 sections. Apply the requested changes faithfully, keep everything else intact, never invent pricing or compliance claims.",
        },
        {
          role: "user",
          content: `Current proposal:\n\n${proposal.content}\n\nRequested changes:\n${data.changeRequest}`,
        },
      ], { provider: data.provider, model: data.model });

      const { data: quote } = await db
        .from("quotes")
        .select("contact_name, company, contact_email, phone, project_type, quote_number")
        .eq("id", proposal.quote_id)
        .single();
      const { composeProposalDocFromQuote, isImportedProposal } = await import("@/lib/documents/proposal");
      const doc =
        isImportedProposal(proposal.model as string) && proposal.doc
          ? proposal.doc
          : quote
            ? composeProposalDocFromQuote(
                {
                  contact_name: quote.contact_name as string,
                  company: (quote.company as string | null) ?? null,
                  contact_email: quote.contact_email as string,
                  phone: (quote.phone as string | null) ?? null,
                  project_type: quote.project_type as string,
                  quote_number: quote.quote_number as string,
                },
                content,
              )
            : null;

      await db
        .from("proposals")
        .update({
          content,
          doc,
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
    }),
  );

/** AI-drafted cost + time estimate. Returns a draft only — never writes to the DB. */
export const draftEstimateWithAi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { quoteId: string; provider?: string; model?: string }) => data)
  .handler(
    guarded("draftEstimateWithAi", "drafting the estimate", async ({ data, context }) => {
      const { requireAdmin, adminDb } = await import("@/lib/blex.server");
      await requireAdmin(context.supabase, context.userId);
      const db = adminDb();

      const { data: quote } = await db
        .from("quotes")
        .select("project_type, industry, services, budget, timeline, goals, features")
        .eq("id", data.quoteId)
        .maybeSingle();
      if (!quote) throw new Error("Quote not found");

      const { data: proposal } = await db
        .from("proposals")
        .select("content")
        .eq("quote_id", data.quoteId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const { parseBudgetBand, describeBand, parseEstimateJson, reconcileToBudget } = await import(
        "@/lib/documents/estimate-ai"
      );
      const band = parseBudgetBand(quote.budget as string | null);

      const prompt = [
        `Project type: ${quote.project_type}`,
        `Industry: ${quote.industry}`,
        `Services: ${(quote.services as string[] | null)?.join(", ") ?? "n/a"}`,
        `Client budget range: ${quote.budget} (${describeBand(band)})`,
        `Timeline preference: ${quote.timeline}`,
        `Goals: ${quote.goals}`,
        `Desired features: ${quote.features ?? "not specified"}`,
        "",
        proposal?.content
          ? `Approved proposal:\n\n${String(proposal.content).slice(0, 12000)}`
          : "No proposal content available; estimate from the intake answers.",
      ].join("\n");

      const budgetRule =
        band?.max === null
          ? "The client chose the open-ended top budget band, so size the work honestly from scope with no upper clamp."
          : `The sum of all line item amounts MUST land inside the client's budget range, targeting the middle-to-upper part of the band.`;

      const { completeChat } = await import("@/lib/ai.server");
      const { content, model, provider } = await completeChat(
        [
          {
            role: "system",
            content:
              "You are a senior delivery lead at BLEXware pricing a software engagement. Return ONLY JSON matching " +
              '{"lineItems":[{"label":string,"amount":number,"durationLabel":string,"note":string}],"durationNote":string,"rationale":string}. ' +
              "One line item per proposal phase or major workstream. `amount` is US dollars (a number, no symbols or commas). " +
              "`durationLabel` is a short span like \"2 weeks\". " +
              budgetRule +
              " Never invent compliance claims or certifications.",
          },
          { role: "user", content: prompt },
        ],
        { provider: data.provider, model: data.model, json: true },
      );

      let parsed;
      try {
        parsed = parseEstimateJson(content);
      } catch {
        throw new Error("The AI returned an estimate that could not be read. Try again or pick another model.");
      }

      const reconciled = reconcileToBudget(parsed.lineItems, band);
      return {
        lineItems: reconciled.lineItems,
        totalCents: reconciled.totalCents,
        adjusted: reconciled.adjusted,
        durationNote: parsed.durationNote,
        rationale: parsed.rationale,
        model,
        provider,
        budget: (quote.budget as string | null) ?? null,
      };
    }),
  );

/** Creates or replaces the draft cost + schedule estimate for an approved proposal. */
export const saveEstimate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: EstimateInput) => {
    if (!data.lineItems?.length) throw new Error("Add at least one line item");
    return data;
  })
  .handler(
    guarded("saveEstimate", "saving the estimate", async ({ data, context }) => {
      const { requireAdmin, adminDb, writeAudit } = await import("@/lib/blex.server");
      await requireAdmin(context.supabase, context.userId);
      const { calculateTotals, buildEstimateDoc, buildProposalDocFromMarkdown, buildPaymentPlan } = await import(
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
      const paymentKind =
        data.paymentKind ?? baseDoc.paymentPlan?.kind ?? "installments";
      if (paymentKind === "custom") {
        const sum = (data.customPayments ?? []).reduce((value, row) => value + row.amountCents, 0);
        if (sum !== totals.totalCents) {
          throw new Error("Custom invoice amounts must add up to the project total.");
        }
      }
      const paymentPlan = buildPaymentPlan(paymentKind, totals.totalCents, data.customPayments);
      if (data.documentTitle?.trim()) baseDoc.documentTitle = data.documentTitle.trim();
      const doc = buildEstimateDoc(baseDoc, {
        lineItems: data.lineItems,
        ...totals,
        paymentPlan,
        ...(data.discountLabel ? { discountLabel: data.discountLabel } : {}),
        ...(data.durationNote ? { durationNote: data.durationNote } : {}),
      });

      const { data: history } = await db
        .from("estimates")
        .select("id, status")
        .eq("quote_id", data.quoteId)
        .order("created_at", { ascending: false });

      const existing = (history ?? [])[0];
      const approved = (history ?? []).find((item) => item.status === "approved");

      // Never silently fork a client-approved estimate: the admin has to opt in
      // to a revision, and the approved row stays intact as the record of record.
      if (approved && !data.revise) {
        throw new Error(
          "This estimate is already approved by the client. Choose “Revise estimate” to start a new version.",
        );
      }

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

      // Saving a draft must never walk the quote backwards past an approval.
      if (!approved) {
        await db.from("quotes").update({ status: "estimate_draft" }).eq("id", data.quoteId);
      }
      await writeAudit({
        actorId: context.userId,
        action: "estimate.saved",
        entity: "quote",
        entityId: data.quoteId,
        metadata: { total_cents: totals.totalCents, revision: Boolean(approved) },
      });

      return { estimateId, totals, revision: Boolean(approved) };
    }),
  );

/**
 * Admin fallback when a client approves the estimate outside the portal
 * (email, phone, in person). Mirrors the client-side approval exactly.
 */
export const markEstimateApproved = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { estimateId: string; note?: string }) => data)
  .handler(
    guarded("markEstimateApproved", "recording the approval", async ({ data, context }) => {
      const { requireAdmin, adminDb, writeAudit } = await import("@/lib/blex.server");
      await requireAdmin(context.supabase, context.userId);
      const db = adminDb();

      const { data: estimate } = await db
        .from("estimates")
        .select("id, quote_id, status")
        .eq("id", data.estimateId)
        .maybeSingle();
      if (!estimate) throw new Error("Estimate not found");
      if (estimate.status === "approved") return { alreadyApproved: true };

      const { error } = await db
        .from("estimates")
        .update({
          status: "approved",
          responded_at: new Date().toISOString(),
          response_note: data.note?.trim()
            ? `Recorded by BLEXware: ${data.note.trim()}`
            : "Approval recorded by BLEXware on the client's behalf.",
        })
        .eq("id", estimate.id);
      if (error) throw new Error(error.message);

      await db.from("quotes").update({ status: "estimate_approved" }).eq("id", estimate.quote_id);
      await writeAudit({
        actorId: context.userId,
        action: "estimate.approved_by_admin",
        entity: "quote",
        entityId: estimate.quote_id as string,
        metadata: { estimateId: estimate.id, note: data.note ?? null },
      });

      return { alreadyApproved: false };
    }),
  );

/** AI suggestion for how to split the contract total into invoices. */
export const suggestInvoiceSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { quoteId: string; totalCents: number; provider?: string; model?: string }) => data)
  .handler(
    guarded("suggestInvoiceSchedule", "suggesting an invoice schedule", async ({ data, context }) => {
      const { requireAdmin, adminDb } = await import("@/lib/blex.server");
      await requireAdmin(context.supabase, context.userId);
      const db = adminDb();

      const { data: quote } = await db
        .from("quotes")
        .select("budget, timeline, project_type")
        .eq("id", data.quoteId)
        .maybeSingle();
      if (!quote) throw new Error("Quote not found");

      const { data: estimate } = await db
        .from("estimates")
        .select("duration_note")
        .eq("quote_id", data.quoteId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const { completeChat } = await import("@/lib/ai.server");
      const { content } = await completeChat(
        [
          {
            role: "system",
            content:
              'Return ONLY JSON: {"count":number,"rationale":string}. `count` must be one of 1, 2, 3, 4, 5, 6, 9 or 12 — the number of even invoices for a software project. ' +
              "Favour fewer invoices for small or short engagements and more for larger, longer ones. Keep each invoice comfortably above $300.",
          },
          {
            role: "user",
            content: [
              `Contract total: $${(data.totalCents / 100).toFixed(2)}`,
              `Client budget band: ${quote.budget ?? "unspecified"}`,
              `Timeline preference: ${quote.timeline ?? "unspecified"}`,
              `Estimated duration: ${estimate?.duration_note ?? "unspecified"}`,
              `Project type: ${quote.project_type ?? "unspecified"}`,
            ].join("\n"),
          },
        ],
        { provider: data.provider, model: data.model, json: true },
      );

      const match = /\{[\s\S]*\}/.exec(content);
      let count = 2;
      let rationale = "";
      if (match) {
        try {
          const parsed = JSON.parse(match[0]) as { count?: number; rationale?: string };
          if (typeof parsed.count === "number") count = parsed.count;
          rationale = parsed.rationale ?? "";
        } catch {
          // fall through to the default split
        }
      }
      const { SPLIT_COUNTS, evenSplitRows } = await import("@/lib/documents/compose");
      const allowed = SPLIT_COUNTS as readonly number[];
      if (!allowed.includes(count)) {
        count = allowed.reduce((best, option) =>
          Math.abs(option - count) < Math.abs(best - count) ? option : best,
        );
      }
      return { count, rationale, rows: evenSplitRows(data.totalCents, count) };
    }),
  );

/** AI draft of the scope/assumptions addendum that goes into the SOW. */
/**
 * AI assistant for the SOW body: drafts the full scope content into the
 * editable markdown area. It does not create an agreement — press
 * "Generate SOW" for that.
 */
export const draftSowWithAi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { estimateId: string; provider?: string; model?: string }) => data)
  .handler(
    guarded("draftSowWithAi", "drafting the statement of work", async ({ data, context }) => {
      const { requireAdmin, adminDb } = await import("@/lib/blex.server");
      await requireAdmin(context.supabase, context.userId);
      const db = adminDb();

      const { data: estimate } = await db
        .from("estimates")
        .select("id, quote_id, doc, line_items, total_cents, duration_note")
        .eq("id", data.estimateId)
        .maybeSingle();
      if (!estimate) throw new Error("Estimate not found");

      const { data: proposal } = await db
        .from("proposals")
        .select("content")
        .eq("quote_id", estimate.quote_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const items = (estimate.line_items as { label: string; durationLabel?: string }[] | null) ?? [];
      const { completeChat } = await import("@/lib/ai.server");
      const { content, model, provider } = await completeChat(
        [
          {
            role: "system",
            content:
              "You draft the full body of a BLEXware Statement of Work. Return markdown with exactly these H2 sections: " +
              "## Scope of Work, ## Deliverables, ## Timeline, ## Client Responsibilities, ## Assumptions & Exclusions. " +
              "The Timeline section derives milestones from the estimated duration and line-item durations. " +
              "Be concrete and specific to the engagement. Never invent pricing, dates, certifications or compliance claims.",
          },
          {
            role: "user",
            content: [
              `Approved line items: ${items.map((item) => `${item.label}${item.durationLabel ? ` (${item.durationLabel})` : ""}`).join("; ") || "n/a"}`,
              `Estimated duration: ${estimate.duration_note ?? "not stated"}`,
              "",
              proposal?.content
                ? `Approved proposal:\n\n${String(proposal.content).slice(0, 12000)}`
                : "No proposal content available.",
            ].join("\n"),
          },
        ],
        { provider: data.provider, model: data.model },
      );

      return { markdown: content, model, provider };
    }),
  );


export const sendEstimate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { estimateId: string }) => data)
  .handler(
    guarded("sendEstimate", "sending the estimate", async ({ data, context }) => {
      const { requireAdmin, adminDb, writeAudit } = await import("@/lib/blex.server");
      await requireAdmin(context.supabase, context.userId);
       const { storeDocument } = await import("@/lib/document-storage.server");
       const { emailEstimateSent, siteUrl } = await import("@/lib/engagement-email.server");
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

      const contactEmail = String(quote.contact_email ?? "").trim();
      if (!contactEmail) throw new Error("This quote has no contact email");

      await storeDocument({
        quoteId: estimate.quote_id as string,
        entity: "estimate",
        entityId: estimate.id as string,
        kind: "estimate",
        doc: estimate.doc as never,
        slug: quote.quote_number as string,
      });

      const { requireEmailSent } = await import("@/lib/email.server");
      requireEmailSent(
        await emailEstimateSent({
          to: contactEmail,
          name: quote.contact_name as string,
          quoteNumber: quote.quote_number as string,
          url: `${siteUrl()}/portal/quotes/${estimate.quote_id as string}`,
          totalCents: Number(estimate.total_cents),
        }),
      );

      await db
        .from("estimates")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", estimate.id);
      await db.from("quotes").update({ status: "estimate_sent" }).eq("id", estimate.quote_id);

      await writeAudit({
        actorId: context.userId,
        action: "estimate.sent",
        entity: "quote",
        entityId: estimate.quote_id as string,
        metadata: { emailed: true },
      });

      return { emailed: true };
    }),
  );

/** Turns an approved estimate into a SOW agreement and sends it for signature. */
/**
 * Step 1 of the SOW flow: builds the agreement record and renders the PDF/Word
 * files. The SOW stays in `draft` until `sendAgreement` emails it to the client.
 */
export const generateAgreement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { estimateId: string; addendum?: string; revise?: boolean }) => data)
  .handler(
    guarded("generateAgreement", "generating the statement of work", async ({ data, context }) => {
      const { requireAdmin, adminDb, writeAudit } = await import("@/lib/blex.server");
      await requireAdmin(context.supabase, context.userId);
      const { buildSowDoc, markdownToSections } = await import("@/lib/documents/compose");
       const { storeDocument } = await import("@/lib/document-storage.server");
       const { emailAgreementSent, siteUrl } = await import("@/lib/engagement-email.server");
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

      const contactEmail = String(quote.contact_email ?? "").trim();
      if (!contactEmail) throw new Error("This quote has no contact email");

      const { data: existing } = await db
        .from("agreements")
        .select("id, agreement_number, status")
        .eq("estimate_id", estimate.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing && existing.status !== "draft" && !data.revise) {
        throw new Error(
          "A statement of work already exists for this estimate. Choose “Revise the statement of work” to issue a new version.",
        );
      }

      if (existing && existing.status !== "draft" && data.revise) {
        // Billing must not be re-based underneath live invoices.
        const { data: liveInvoices } = await db
          .from("invoices")
          .select("id, status")
          .eq("agreement_id", existing.id);
        const blocking = (liveInvoices ?? []).filter(
          (invoice) => !["draft", "void", "cancelled"].includes(String(invoice.status)),
        );
        if (blocking.length) {
          throw new Error(
            "Invoices have already been issued against this SOW. Void or cancel them before revising it.",
          );
        }
        await db.from("agreements").update({ status: "void" }).eq("id", existing.id);
        await writeAudit({
          actorId: context.userId,
          action: "agreement.revised",
          entity: "quote",
          entityId: estimate.quote_id as string,
          metadata: { voidedAgreementId: existing.id },
        });
      }

      let agreement: { id: string; agreement_number: string };
      if (existing?.status === "draft") {
        agreement = {
          id: existing.id as string,
          agreement_number: existing.agreement_number as string,
        };
      } else {
        const { data: inserted, error } = await db
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
        if (error || !inserted) throw new Error(error?.message ?? "Could not create the agreement");
        agreement = {
          id: inserted.id as string,
          agreement_number: inserted.agreement_number as string,
        };
      }

      const sourceDoc = estimate.doc as import("@/lib/documents/types").ProjectDocument;
      const addendum = data.addendum?.trim();
      const docInput = addendum
        ? { ...sourceDoc, sections: [...(sourceDoc.sections ?? []), ...markdownToSections(addendum)] }
        : sourceDoc;

      const doc = buildSowDoc(docInput as never, {
        agreementNumber: agreement.agreement_number as string,
        totalCents: Number(estimate.total_cents),
        paymentPlan: sourceDoc?.paymentPlan,
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
        .update({ doc, total_cents: estimate.total_cents })
        .eq("id", agreement.id);

      await writeAudit({
        actorId: context.userId,
        action: "agreement.generated",
        entity: "quote",
        entityId: estimate.quote_id as string,
        metadata: { agreement: agreement.agreement_number, revised: data.revise === true },
      });

      return { agreementId: agreement.id as string };
    }),
  );

/**
 * Step 2 of the SOW flow: emails the drafted agreement to the client for
 * signature and moves the quote to `contract_sent`.
 */
export const sendAgreement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { agreementId: string }) => data)
  .handler(
    guarded("sendAgreement", "sending the statement of work", async ({ data, context }) => {
      const { requireAdmin, adminDb, writeAudit } = await import("@/lib/blex.server");
      await requireAdmin(context.supabase, context.userId);
      const db = adminDb();

      const { data: agreement } = await db
        .from("agreements")
        .select("id, quote_id, agreement_number, status, doc")
        .eq("id", data.agreementId)
        .maybeSingle();
      if (!agreement) throw new Error("Agreement not found");
      if (agreement.status !== "draft") {
        throw new Error("Only a drafted SOW can be sent. Void and regenerate it to make changes.");
      }
      if (!agreement.doc) throw new Error("Generate the SOW document before sending it.");

      const { data: quote } = await db
        .from("quotes")
        .select("contact_name, contact_email")
        .eq("id", agreement.quote_id as string)
        .maybeSingle();
      if (!quote) throw new Error("Quote not found");

      const { requireEmailSent } = await import("@/lib/email.server");
      const { emailAgreementSent, siteUrl } = await import("@/lib/engagement-email.server");
      requireEmailSent(
        await emailAgreementSent({
          to: quote.contact_email as string,
          name: quote.contact_name as string,
          agreementNumber: agreement.agreement_number as string,
          url: `${siteUrl()}/portal/quotes/${agreement.quote_id as string}`,
        }),
      );

      await db
        .from("agreements")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", agreement.id);
      await db.from("quotes").update({ status: "contract_sent" }).eq("id", agreement.quote_id);

      await writeAudit({
        actorId: context.userId,
        action: "agreement.sent",
        entity: "quote",
        entityId: agreement.quote_id as string,
        metadata: { agreement: agreement.agreement_number, emailed: true },
      });

      return { agreementId: agreement.id as string, emailed: true };
    }),
  );

/**
 * Admin approval of a signed SOW: countersigns for BLEXware, records the
 * project start date and issues the first invoice ahead of that date.
 */
export const approveProjectStart = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { agreementId: string; startDate: string }) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.startDate)) throw new Error("Choose a project start date");
    return data;
  })
  .handler(
    guarded("approveProjectStart", "approving the project start", async ({ data, context }) => {
      const { requireAdmin, adminDb, writeAudit } = await import("@/lib/blex.server");
      await requireAdmin(context.supabase, context.userId);
       const { storeDocument } = await import("@/lib/document-storage.server");
      const { createInvoiceSchedule } = await import("@/lib/invoicing.server");
      const db = adminDb();

      const { data: agreement } = await db
        .from("agreements")
        .select("id, quote_id, agreement_number, status, doc")
        .eq("id", data.agreementId)
        .maybeSingle();
      if (!agreement) throw new Error("Agreement not found");
      if (agreement.status !== "signed") throw new Error("The client has not signed this agreement yet.");

      const now = new Date();
      const start = new Date(`${data.startDate}T00:00:00Z`);
      // First invoice is due three days before work starts.
      const dueDate = new Date(start.getTime() - 3 * 86_400_000).toISOString().slice(0, 10);
      const startLabel = start.toLocaleDateString("en-US", {
        timeZone: "UTC",
        month: "long",
        day: "numeric",
        year: "numeric",
      });

      const existingDoc = (agreement.doc ?? {}) as Record<string, unknown>;
      const acceptance = (existingDoc["acceptance"] ?? {}) as Record<string, unknown>;
      const countersignedDoc = {
        ...existingDoc,
        acceptance: {
          ...acceptance,
          countersign: {
            name: "Kamal Eley",
            title: "Developer, BLEXware",
            signatureText: "Kamal Eley",
            signedAt: now.toLocaleString("en-US"),
            startDate: startLabel,
          },
        },
      };

      await storeDocument({
        quoteId: agreement.quote_id as string,
        entity: "agreement",
        entityId: agreement.id as string,
        kind: "sow_countersigned",
        doc: countersignedDoc as never,
        slug: agreement.agreement_number as string,
      });

      await db
        .from("agreements")
        .update({ doc: countersignedDoc })
        .eq("id", agreement.id);

      const schedule = await createInvoiceSchedule(agreement.id as string, { firstDueDate: dueDate });

      await writeAudit({
        actorId: context.userId,
        action: "agreement.countersigned",
        entity: "quote",
        entityId: agreement.quote_id as string,
        metadata: { agreement: agreement.agreement_number, startDate: data.startDate, dueDate },
      });

      return { startDate: data.startDate, firstInvoiceDue: dueDate, invoices: schedule.created };
    }),
  );

export const getDocumentUrl = createServerFn({ method: "POST" })

  .middleware([requireSupabaseAuth])
  .validator((data: { documentId: string }) => data)
  .handler(
    guarded("getDocumentUrl", "preparing the download", async ({ data, context }) => {
      const { requireAdmin, adminDb } = await import("@/lib/blex.server");
      await requireAdmin(context.supabase, context.userId);
       const { signedDocumentUrl } = await import("@/lib/document-storage.server");

      const { data: doc } = await adminDb()
        .from("documents")
        .select("storage_path")
        .eq("id", data.documentId)
        .maybeSingle();
      if (!doc) throw new Error("Document not found");
      return { url: await signedDocumentUrl(doc.storage_path as string) };
    }),
  );

/** Sends (or resends) the next scheduled invoice immediately. */
export const sendInvoiceNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { invoiceId: string }) => data)
  .handler(
    guarded("sendInvoiceNow", "sending the invoice", async ({ data, context }) => {
      const { requireAdmin } = await import("@/lib/blex.server");
      await requireAdmin(context.supabase, context.userId);
      const { dispatchInvoice } = await import("@/lib/invoicing.server");
      const result = await dispatchInvoice(data.invoiceId);
      return result;
    }),
  );

/** Issues a full or partial refund against a settled payment. */
export const refundPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { invoicePaymentId: string; amountCents: number; reason?: string }) => {
    if (!Number.isInteger(data.amountCents) || data.amountCents <= 0) {
      throw new Error("Enter a refund amount greater than zero.");
    }
    return data;
  })
  .handler(
    guarded("refundPayment", "issuing the refund", async ({ data, context }) => {
      const { requireAdmin } = await import("@/lib/blex.server");
      await requireAdmin(context.supabase, context.userId);
      const { refundInvoicePayment } = await import("@/lib/invoicing.server");
      return refundInvoicePayment({
        invoicePaymentId: data.invoicePaymentId,
        amountCents: data.amountCents,
        reason: data.reason ?? null,
        actorId: context.userId,
      });
    }),
  );

/** Records a payment received outside the platform (check, bank transfer). */
export const recordOfflinePaymentFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { invoiceId: string; amountCents: number; note?: string }) => {
    if (!Number.isInteger(data.amountCents) || data.amountCents <= 0) {
      throw new Error("Enter an amount greater than zero.");
    }
    return data;
  })
  .handler(
    guarded("recordOfflinePaymentFn", "recording the payment", async ({ data, context }) => {
      const { requireAdmin } = await import("@/lib/blex.server");
      await requireAdmin(context.supabase, context.userId);
      const { recordOfflinePayment } = await import("@/lib/invoicing.server");
      return recordOfflinePayment({
        invoiceId: data.invoiceId,
        amountCents: data.amountCents,
        note: data.note ?? null,
        actorId: context.userId,
      });
    }),
  );

/** Re-reads the authoritative status from the payment service. */
export const reconcilePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { providerPaymentId: string }) => data)
  .handler(
    guarded("reconcilePayment", "reconciling the payment", async ({ data, context }) => {
      const { requireAdmin } = await import("@/lib/blex.server");
      await requireAdmin(context.supabase, context.userId);
      const { syncPayment } = await import("@/lib/invoicing.server");
      return syncPayment(data.providerPaymentId);
    }),
  );

/**
 * Read-only settlement/payout view for a settled payment, straight from the
 * gateway. No payout credentials or bank details are returned.
 */
export const getPaymentSettlement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { providerPaymentId: string }) => data)
  .handler(
    guarded("getPaymentSettlement", "loading the payout status", async ({ data, context }) => {
      const { requireAdmin } = await import("@/lib/blex.server");
      await requireAdmin(context.supabase, context.userId);
      const { PaymentService } = await import("@/lib/payments/service.server");
      if (!PaymentService.isConfigured()) return null;
      return PaymentService.getSettlement(data.providerPaymentId);
    }),
  );


/** Which payment methods clients can currently choose from. */
export const getPaymentMethodSettingsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(
    guarded("getPaymentMethodSettings", "loading the payment settings", async ({ context }) => {
      const { requireAdmin } = await import("@/lib/blex.server");
      await requireAdmin(context.supabase, context.userId);
      const { getPaymentMethodSettings } = await import("@/lib/settings.server");
      return getPaymentMethodSettings();
    }),
  );

/** Turns bank (ACH) or card payments on/off for every client invoice. */
export const setPaymentMethodEnabledFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { method: "bank" | "card"; enabled: boolean }) => {
    if (data.method !== "bank" && data.method !== "card") throw new Error("Unknown payment method");
    return { method: data.method, enabled: Boolean(data.enabled) };
  })
  .handler(
    guarded("setPaymentMethodEnabled", "saving the payment settings", async ({ data, context }) => {
      const { requireAdmin } = await import("@/lib/blex.server");
      await requireAdmin(context.supabase, context.userId);
      const { setPaymentMethodEnabled } = await import("@/lib/settings.server");
      return setPaymentMethodEnabled({
        method: data.method,
        enabled: data.enabled,
        actorId: context.userId,
      });
    }),
  );
