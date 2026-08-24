// Seeds the live Build Financial Wellness engagement so the real client can
// move through approval → SOW signature → invoicing inside the portal.
import { adminDb } from "@/lib/blex.server";
import {
  BFW_CLIENT,
  BFW_DISCOUNT_CENTS,
  BFW_LINE_ITEMS,
  BFW_PAYMENT_PLAN,
  BFW_QUOTE_INTAKE,
  BFW_SUBTOTAL_CENTS,
  BFW_TOTAL_CENTS,
  buildBfwProposalDoc,
} from "@/content/build-financial-wellness";
import { sectionsToMarkdown } from "@/lib/documents/compose";
import { storeDocument } from "@/lib/document-storage.server";

export async function seedBuildFinancialWellness() {
  const db = adminDb();
  const email = BFW_CLIENT.email.toLowerCase();
  const proposalDoc = buildBfwProposalDoc();
  const estimateDoc = { ...proposalDoc, kind: "estimate" as const, paymentPlan: BFW_PAYMENT_PLAN };
  const markdown = sectionsToMarkdown(proposalDoc.sections);

  const quoteFields = {
    project_type: BFW_QUOTE_INTAKE.projectType,
    industry: BFW_QUOTE_INTAKE.industry,
    services: BFW_QUOTE_INTAKE.services,
    goals: BFW_QUOTE_INTAKE.goals,
    features: BFW_QUOTE_INTAKE.features,
    budget: BFW_QUOTE_INTAKE.budget,
    timeline: BFW_QUOTE_INTAKE.timeline,
    contact_name: BFW_CLIENT.name,
    contact_email: email,
    company: BFW_CLIENT.company,
    phone: BFW_CLIENT.phone,
    consent: true,
    internal_notes:
      "Imported from the signed-off August 2026 proposal document. Newsletter module previously paid. Invoice split 50/50 ($520 / $520).",
  };

  const { data: existing } = await db
    .from("quotes")
    .select("id, quote_number, status")
    .eq("contact_email", email)
    .is("deleted_at", null)
    .maybeSingle();

  let quoteId = existing?.id as string | undefined;
  let quoteNumber = existing?.quote_number as string | undefined;

  if (!quoteId) {
    const { data: quote, error } = await db
      .from("quotes")
      .insert({ ...quoteFields, status: "estimate_sent" })
      .select("id, quote_number")
      .single();
    if (error) throw new Error(error.message);
    quoteId = quote.id as string;
    quoteNumber = quote.quote_number as string;
  } else {
    await db.from("quotes").update(quoteFields).eq("id", quoteId);
  }

  const proposalRow = {
    quote_id: quoteId,
    status: "approved",
    model: "manual/imported",
    prompt: "Imported from the delivered Build Financial Wellness proposal document.",
    content: markdown,
    doc: proposalDoc,
    sent_at: new Date().toISOString(),
    responded_at: new Date().toISOString(),
    client_response_note: "Approved by email prior to the portal launch.",
  };

  const { data: existingProposal } = await db.from("proposals").select("id").eq("quote_id", quoteId).maybeSingle();
  let proposalId = existingProposal?.id as string | undefined;
  if (!proposalId) {
    const { data: proposal, error } = await db.from("proposals").insert(proposalRow).select("id").single();
    if (error) throw new Error(error.message);
    proposalId = proposal.id as string;
  } else {
    await db.from("proposals").update(proposalRow).eq("id", proposalId);
  }

  const estimateRow = {
    quote_id: quoteId,
    proposal_id: proposalId,
    status: "sent",
    doc: estimateDoc,
    line_items: BFW_LINE_ITEMS,
    subtotal_cents: BFW_SUBTOTAL_CENTS,
    discount_cents: BFW_DISCOUNT_CENTS,
    total_cents: BFW_TOTAL_CENTS,
    duration_note: "24–36 business days from kickoff",
    sent_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 5 * 86_400_000).toISOString(),
  };

  const { data: existingEstimate } = await db.from("estimates").select("id").eq("quote_id", quoteId).maybeSingle();
  let estimateId = existingEstimate?.id as string | undefined;
  if (!estimateId) {
    const { data: estimate, error } = await db.from("estimates").insert(estimateRow).select("id").single();
    if (error) throw new Error(error.message);
    estimateId = estimate.id as string;
  } else {
    await db.from("estimates").update(estimateRow).eq("id", estimateId);
  }

  if (!existing?.status || existing.status === "new" || existing.status === "proposal_draft") {
    await db.from("quotes").update({ status: "estimate_sent" }).eq("id", quoteId);
  }

  await storeDocument({
    quoteId: quoteId!,
    entity: "estimate",
    entityId: estimateId!,
    kind: "estimate",
    doc: estimateDoc,
    slug: quoteNumber ?? "BFW",
  });

  return { quoteId: quoteId!, quoteNumber: quoteNumber ?? "", estimateId: estimateId!, proposalId: proposalId! };
}
