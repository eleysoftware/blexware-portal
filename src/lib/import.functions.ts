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
};

const ESTIMATE_STAGES: ImportStage[] = ["estimate_draft", "estimate_sent", "estimate_approved"];

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
