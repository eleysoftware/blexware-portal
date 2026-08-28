// Prefill templates for the "Import existing project" form. These only fill in
// the form fields — nothing is written to the database until the admin reviews
// the values and presses "Import project".

import {
  BFW_CLIENT,
  BFW_DISCOUNT_CENTS,
  BFW_DOCUMENT_TITLE,
  BFW_LINE_ITEMS,
  BFW_QUOTE_INTAKE,
  buildBfwProposalDoc,
} from "@/content/build-financial-wellness";
import { sectionsToMarkdown } from "@/lib/documents/compose";
import type { ImportStage } from "@/lib/import.functions";

export type ImportTemplate = {
  id: string;
  label: string;
  description: string;
  build: () => {
    contactName: string;
    contactEmail: string;
    company: string;
    phone: string;
    projectType: string;
    industry: string;
    services: string;
    budget: string;
    timeline: string;
    goals: string;
    features: string;
    documentTitle: string;
    proposalMarkdown: string;
    stage: ImportStage;
    durationNote: string;
    discount: string;
    discountLabel: string;
    rows: { label: string; amount: string; duration: string }[];
  };
};

export const importTemplates: ImportTemplate[] = [
  {
    id: "build-financial-wellness",
    label: "Build Financial Wellness",
    description: "Tamara West · website enhancement proposal, estimate already approved.",
    build: () => ({
      contactName: BFW_CLIENT.name,
      contactEmail: BFW_CLIENT.email,
      company: BFW_CLIENT.company,
      phone: BFW_CLIENT.phone,
      projectType: BFW_QUOTE_INTAKE.projectType,
      industry: BFW_QUOTE_INTAKE.industry,
      services: BFW_QUOTE_INTAKE.services.join(", "),
      budget: BFW_QUOTE_INTAKE.budget,
      timeline: BFW_QUOTE_INTAKE.timeline,
      goals: BFW_QUOTE_INTAKE.goals,
      features: BFW_QUOTE_INTAKE.features,
      documentTitle: BFW_DOCUMENT_TITLE,
      proposalMarkdown: sectionsToMarkdown(buildBfwProposalDoc().sections),
      stage: "estimate_approved",
      durationNote: "24–36 business days from kickoff",
      discount: (BFW_DISCOUNT_CENTS / 100).toString(),
      discountLabel: "Preferred Client Loyalty Discount (20%)",
      rows: BFW_LINE_ITEMS.map((item) => ({
        label: item.label,
        amount: (item.amountCents / 100).toString(),
        duration: item.durationLabel ?? "",
      })),
    }),
  },
];
