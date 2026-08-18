import { z } from "zod";

export const quoteSchema = z.object({
  projectType: z.string().min(1, "Choose a project type"),
  industry: z.string().min(1, "Choose your industry"),
  services: z.array(z.string()).min(1, "Select at least one service"),
  goals: z.string().trim().min(20, "Give us at least a sentence or two").max(2000),
  features: z.string().trim().max(2000).optional(),
  budget: z.string().min(1, "Choose a budget range"),
  timeline: z.string().min(1, "Choose a timeline"),
  name: z.string().trim().min(2, "Enter your name").max(80),
  email: z.string().trim().email("Enter a valid email address").max(160),
  company: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(40).optional(),
  consent: z.literal(true, { message: "Please accept the privacy notice" }),
});

export type QuoteInput = z.infer<typeof quoteSchema>;

export const MAX_FILES = 3;
export const MAX_FILE_BYTES = 20 * 1024 * 1024;

export const quoteStatuses = [
  "new",
  "reviewing",
  "proposal_draft",
  "proposal_sent",
  "approved",
  "estimate_draft",
  "estimate_sent",
  "estimate_approved",
  "contract_sent",
  "signed",
  "invoicing",
  "completed",
  "declined",
] as const;

export type QuoteStatus = (typeof quoteStatuses)[number];

export const quoteStatusLabels: Record<QuoteStatus, string> = {
  new: "New",
  reviewing: "Reviewing",
  proposal_draft: "Proposal draft",
  proposal_sent: "Proposal sent",
  approved: "Proposal approved",
  estimate_draft: "Estimate draft",
  estimate_sent: "Estimate sent",
  estimate_approved: "Estimate approved",
  contract_sent: "SOW sent",
  signed: "SOW signed",
  invoicing: "Invoicing",
  completed: "Completed",
  declined: "Declined",
};


export type QuoteRecord = {
  id: string;
  quote_number: string;
  status: QuoteStatus;
  project_type: string;
  industry: string;
  services: string[];
  goals: string;
  features: string | null;
  budget: string;
  timeline: string;
  contact_name: string;
  contact_email: string;
  company: string | null;
  phone: string | null;
  internal_notes: string | null;
  created_at: string;
};

export type QuoteFileRecord = {
  id: string;
  original_name: string;
  byte_size: number;
  mime_type: string;
  created_at: string;
};

export type ProposalStatus =
  | "draft"
  | "sent"
  | "approved"
  | "changes_requested"
  | "declined";

export type ProposalRecord = {
  id: string;
  quote_id: string;
  status: ProposalStatus;
  model: string;
  content: string;
  review_token: string;
  client_response_note: string | null;
  sent_at: string | null;
  responded_at: string | null;
  created_at: string;
  doc?: import("@/lib/documents/types").ProjectDocument | null;
};
