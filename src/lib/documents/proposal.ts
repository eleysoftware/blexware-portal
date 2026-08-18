import { buildProposalDocFromMarkdown } from "@/lib/documents/compose";
import type { ProjectDocument } from "@/lib/documents/types";

export const IMPORTED_PROPOSAL_MODEL = "manual/imported";

export type QuotePartyFields = {
  contact_name: string;
  company?: string | null;
  contact_email: string;
  phone?: string | null;
  project_type: string;
  quote_number: string;
};

export function isImportedProposal(model: string | null | undefined) {
  return model === IMPORTED_PROPOSAL_MODEL;
}

export function hasStructuredProposalDoc(doc: unknown): doc is ProjectDocument {
  return Boolean(
    doc &&
      typeof doc === "object" &&
      Array.isArray((doc as ProjectDocument).sections) &&
      (doc as ProjectDocument).sections.length > 0,
  );
}

/** Rebuild markdown JSON unless this is an imported structured doc (BFW). */
export function shouldRebuildProposalDoc(model: string | null | undefined, doc: unknown) {
  return !(isImportedProposal(model) && hasStructuredProposalDoc(doc));
}

export function composeProposalDocFromQuote(
  quote: QuotePartyFields,
  markdown: string,
  documentTitle?: string,
): ProjectDocument {
  return buildProposalDocFromMarkdown({
    markdown,
    clientName: quote.contact_name,
    clientCompany: quote.company ?? null,
    clientEmail: quote.contact_email,
    clientPhone: quote.phone ?? null,
    projectType: quote.project_type,
    quoteNumber: quote.quote_number,
    documentTitle,
  });
}
