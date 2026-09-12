import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { guarded } from "@/lib/errors";
import type { EstimateLineItem } from "@/lib/documents/types";

export type ImportStage =
  | "proposal_draft"
  | "proposal_sent"
  | "approved"
  | "estimate_draft"
  | "estimate_sent"
  | "estimate_approved";

export type ImportProjectInput = {
  contactName: string;
  contactEmail: string;
  company?: string;
  phone?: string;
  projectType: string;
  industry: string;
  services: string[];
  budget: string;
  timeline: string;
  goals: string;
  features?: string;
  internalNotes?: string;
  documentTitle?: string;
  proposalMarkdown: string;
  stage: ImportStage;
  lineItems?: EstimateLineItem[];
  discountCents?: number;
  discountLabel?: string;
  durationNote?: string;
  paymentKind?: import("@/lib/documents/types").PaymentPlanKind;
  customPayments?: { label: string; amountCents: number }[];
  /** Project phases, created as milestones in the "Not started" lane. */
  phases?: string[];
};

const ESTIMATE_STAGES: ImportStage[] = ["estimate_draft", "estimate_sent", "estimate_approved"];

export type ExtractProposalInput = {
  fileName: string;
  contentType?: string;
  base64: string;
};

export type ExtractedLineItem = {
  label: string;
  amountCents: number;
  durationLabel?: string;
};

export type ExtractProposalResult = {
  markdown: string;
  documentTitle?: string;
  contactName?: string;
  contactEmail?: string;
  company?: string;
  projectType?: string;
  lineItems?: ExtractedLineItem[];
  discountCents?: number;
  discountLabel?: string;
  durationNote?: string;
  phases?: string[];
  aiFormatted: boolean;
};

const EXTRACT_SYSTEM_PROMPT = [
  "You reformat client proposals into BLEXware's proposal format.",
  "Return JSON only, with keys: markdown, documentTitle, contactName, contactEmail, company, projectType,",
  "lineItems, discountCents, discountLabel, durationNote, phases.",
  "markdown: the full proposal rewritten as markdown using '## ' headings for each section",
  "(e.g. Overview, Objectives, Scope of Work, Deliverables, Timeline, Investment, Assumptions, Next Steps).",
  "lineItems: array of {label, amountCents (integer cents), durationLabel} for every priced phase or",
  "deliverable stated in the document. discountCents: integer cents of any stated discount, with",
  "discountLabel. durationNote: the overall project duration sentence, e.g. '24-36 business days'.",
  "phases: the ordered list of project phase names exactly as the document names them.",
  "Keep the original wording, numbers, prices and dates — reorganise, never invent.",
  "Drop page numbers, headers, footers and signature blocks. Use '- ' for lists.",
  "Leave a field out entirely when the document does not clearly state it.",
].join(" ");

/** Keeps only well-formed, positively priced rows from the model's JSON. */
export function normaliseExtractedLineItems(input: unknown): ExtractedLineItem[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((row) => {
      const entry = row as { label?: unknown; amountCents?: unknown; durationLabel?: unknown };
      const label = typeof entry.label === "string" ? entry.label.trim() : "";
      const amount = Number(entry.amountCents);
      if (!label || !Number.isFinite(amount) || amount <= 0) return null;
      const duration =
        typeof entry.durationLabel === "string" && entry.durationLabel.trim()
          ? entry.durationLabel.trim()
          : undefined;
      return {
        label,
        amountCents: Math.round(amount),
        ...(duration ? { durationLabel: duration } : {}),
      } satisfies ExtractedLineItem;
    })
    .filter((row): row is ExtractedLineItem => row !== null);
}

/** Phase names from the document, falling back to priced line-item labels. */
export function normalisePhases(input: unknown, lineItems: ExtractedLineItem[]): string[] {
  const fromDoc = Array.isArray(input)
    ? input
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .filter((value) => value.length > 0 && value.length <= 200)
    : [];
  if (fromDoc.length) return fromDoc;
  return lineItems.filter((item) => /phase|milestone|sprint|stage/i.test(item.label)).map((item) => item.label);
}

/** Reads an uploaded PDF/Word/markdown proposal and returns BLEXware-formatted markdown. */
export const extractProposalFromFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: ExtractProposalInput) => {
    if (!data.fileName?.trim()) throw new Error("Choose a file to upload");
    if (!data.base64) throw new Error("That file could not be read");
    if (data.base64.length > 14_000_000) throw new Error("That file is larger than 10 MB");
    return data;
  })
  .handler(
    guarded("extractProposalFromFile", "reading the document", async ({ data, context }) => {
      const { requireAdmin } = await import("@/lib/blex.server");
      await requireAdmin(context.supabase, context.userId);
      const { extractDocumentText } = await import("@/lib/documents/extract.server");

      const binary = atob(data.base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);

      const rawText = await extractDocumentText({
        fileName: data.fileName,
        ...(data.contentType ? { contentType: data.contentType } : {}),
        bytes,
      });

      try {
        const { completeChat } = await import("@/lib/ai.server");
        const { content } = await completeChat(
          [
            { role: "system", content: EXTRACT_SYSTEM_PROMPT },
            { role: "user", content: rawText.slice(0, 60_000) },
          ],
          { json: true },
        );
        const parsed = JSON.parse(content) as Partial<ExtractProposalResult>;
        const markdown = parsed.markdown?.trim();
        if (!markdown) throw new Error("empty markdown from AI");
        const lineItems = normaliseExtractedLineItems(parsed.lineItems);
        const phases = normalisePhases(parsed.phases, lineItems);
        const discountCents = Number(parsed.discountCents);
        return {
          markdown,
          ...(parsed.documentTitle?.trim() ? { documentTitle: parsed.documentTitle.trim() } : {}),
          ...(parsed.contactName?.trim() ? { contactName: parsed.contactName.trim() } : {}),
          ...(parsed.contactEmail?.trim() ? { contactEmail: parsed.contactEmail.trim() } : {}),
          ...(parsed.company?.trim() ? { company: parsed.company.trim() } : {}),
          ...(parsed.projectType?.trim() ? { projectType: parsed.projectType.trim() } : {}),
          ...(lineItems.length ? { lineItems } : {}),
          ...(Number.isFinite(discountCents) && discountCents > 0
            ? {
                discountCents: Math.round(discountCents),
                discountLabel: parsed.discountLabel?.trim() || "Discount",
              }
            : {}),
          ...(parsed.durationNote?.trim() ? { durationNote: parsed.durationNote.trim() } : {}),
          ...(phases.length ? { phases } : {}),
          aiFormatted: true,
        } as ExtractProposalResult;
      } catch (error) {
        console.warn("[extractProposalFromFile] AI formatting unavailable", error);
        return { markdown: rawText, aiFormatted: false } as ExtractProposalResult;
      }
    }),
  );

/**
 * Brings an engagement that started outside the portal (a proposal already
 * written and sometimes already approved) into the pipeline at the right stage.
 */
export const importProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: ImportProjectInput) => {
    if (!data.contactName?.trim()) throw new Error("Enter the client contact name");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.contactEmail ?? "")) {
      throw new Error("Enter a valid client email address");
    }
    if (!data.proposalMarkdown?.trim()) throw new Error("Paste the proposal content");
    if (ESTIMATE_STAGES.includes(data.stage) && !data.lineItems?.length) {
      throw new Error("Add at least one estimate line item for this stage");
    }
    return data;
  })
  .handler(
    guarded("importProject", "importing the project", async ({ data, context }) => {
      const { requireAdmin, adminDb, writeAudit } = await import("@/lib/blex.server");
      await requireAdmin(context.supabase, context.userId);
      const { buildProposalDocFromMarkdown, buildEstimateDoc, buildPaymentPlan, calculateTotals } =
        await import("@/lib/documents/compose");
      const db = adminDb();

      const email = data.contactEmail.trim().toLowerCase();
      const now = new Date().toISOString();
      const withEstimate = ESTIMATE_STAGES.includes(data.stage);

      const quoteStatus =
        data.stage === "proposal_draft"
          ? "proposal_draft"
          : data.stage === "proposal_sent"
            ? "proposal_sent"
            : data.stage === "approved"
              ? "approved"
              : data.stage;

      const { data: quote, error: quoteError } = await db
        .from("quotes")
        .insert({
          status: quoteStatus,
          project_type: data.projectType.trim() || "Custom software",
          industry: data.industry.trim() || "Other",
          services: data.services.length ? data.services : ["Custom software"],
          goals: data.goals.trim() || "Imported engagement",
          features: data.features?.trim() || null,
          budget: data.budget.trim() || "Not stated",
          timeline: data.timeline.trim() || "Not stated",
          contact_name: data.contactName.trim(),
          contact_email: email,
          company: data.company?.trim() || null,
          phone: data.phone?.trim() || null,
          consent: true,
          internal_notes: data.internalNotes?.trim() || "Imported from an existing proposal document.",
        })
        .select("id, quote_number")
        .single();
      if (quoteError || !quote) throw new Error(quoteError?.message ?? "Could not create the project");

      const quoteId = quote.id as string;
      const proposalDoc = buildProposalDocFromMarkdown({
        markdown: data.proposalMarkdown,
        clientName: data.contactName.trim(),
        clientCompany: data.company?.trim() || null,
        clientEmail: email,
        clientPhone: data.phone?.trim() || null,
        projectType: data.projectType.trim() || "Custom software",
        quoteNumber: quote.quote_number as string,
      });
      if (data.documentTitle?.trim()) proposalDoc.documentTitle = data.documentTitle.trim();

      const proposalApproved = data.stage !== "proposal_draft" && data.stage !== "proposal_sent";
      const { data: proposal, error: proposalError } = await db
        .from("proposals")
        .insert({
          quote_id: quoteId,
          status:
            data.stage === "proposal_draft" ? "draft" : proposalApproved ? "approved" : "sent",
          model: "manual/imported",
          prompt: "Imported from an existing proposal document.",
          content: data.proposalMarkdown,
          doc: proposalDoc,
          sent_at: data.stage === "proposal_draft" ? null : now,
          responded_at: proposalApproved ? now : null,
          client_response_note: proposalApproved ? "Approved before the project was imported." : null,
        })
        .select("id")
        .single();
      if (proposalError || !proposal) throw new Error(proposalError?.message ?? "Could not save the proposal");

      let estimateId: string | null = null;
      if (withEstimate) {
        const totals = calculateTotals(data.lineItems!, data.discountCents ?? 0);
        const paymentPlan = buildPaymentPlan(
          data.paymentKind ?? "installments",
          totals.totalCents,
          data.customPayments,
        );
        const estimateDoc = buildEstimateDoc(proposalDoc, {
          lineItems: data.lineItems!,
          ...totals,
          paymentPlan,
          ...(data.discountLabel ? { discountLabel: data.discountLabel } : {}),
          ...(data.durationNote ? { durationNote: data.durationNote } : {}),
        });

        const status =
          data.stage === "estimate_draft" ? "draft" : data.stage === "estimate_sent" ? "sent" : "approved";
        const { data: estimate, error: estimateError } = await db
          .from("estimates")
          .insert({
            quote_id: quoteId,
            proposal_id: proposal.id,
            status,
            doc: estimateDoc,
            line_items: data.lineItems,
            subtotal_cents: totals.subtotalCents,
            discount_cents: totals.discountCents,
            total_cents: totals.totalCents,
            duration_note: data.durationNote ?? null,
            sent_at: status === "draft" ? null : now,
            responded_at: status === "approved" ? now : null,
            response_note: status === "approved" ? "Approved before the project was imported." : null,
          })
          .select("id")
          .single();
        if (estimateError || !estimate) throw new Error(estimateError?.message ?? "Could not save the estimate");
        estimateId = estimate.id as string;
      }

      const phases = (data.phases ?? [])
        .map((phase) => phase.trim())
        .filter(Boolean)
        .slice(0, 40);
      if (phases.length) {
        const { error: milestoneError } = await db.from("project_milestones").insert(
          phases.map((title, index) => ({
            quote_id: quoteId,
            title,
            lane: "not_started",
            position: index,
          })),
        );
        if (milestoneError) console.error("[importProject] milestones", milestoneError.message);
      }

      await writeAudit({
        actorId: context.userId,
        action: "project.imported",
        entity: "quote",
        entityId: quoteId,
        metadata: { stage: data.stage, quote_number: quote.quote_number, estimate: Boolean(estimateId) },
      });

      return {
        quoteId,
        quoteNumber: quote.quote_number as string,
        proposalId: proposal.id as string,
        estimateId,
      };
    }),
  );
