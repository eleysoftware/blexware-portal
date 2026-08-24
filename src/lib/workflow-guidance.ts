import type { QuoteStatus } from "@/lib/quote-schema";

export type Audience = "client" | "admin";
export type Actor = "client" | "admin" | "none";

/** Tab ids shared by the client portal and admin workspace. */
export type GuidanceTab = "overview" | "intake" | "proposal" | "estimate" | "sow" | "invoices";

export type StageGuidance = {
  /** Tab where the next step happens (or where the upcoming step will appear). */
  tab: GuidanceTab;
  /** Who owes the next action. */
  actor: Actor;
  clientMessage: string;
  adminMessage: string;
};

const GUIDANCE: Record<QuoteStatus, StageGuidance> = {
  new: {
    tab: "proposal",
    actor: "admin",
    clientMessage:
      "We're reviewing your request and preparing your proposal. We'll email you as soon as it's ready.",
    adminMessage: "Review the intake answers, then generate and send the proposal draft.",
  },
  reviewing: {
    tab: "proposal",
    actor: "admin",
    clientMessage:
      "We're reviewing your request and preparing your proposal. We'll email you as soon as it's ready.",
    adminMessage: "Generate the proposal draft and send it to the client.",
  },
  proposal_draft: {
    tab: "proposal",
    actor: "admin",
    clientMessage: "We're finalising your proposal. We'll email you as soon as it's ready.",
    adminMessage: "Finish reviewing the draft, then send the proposal to the client.",
  },
  proposal_sent: {
    tab: "proposal",
    actor: "client",
    clientMessage: "Review your proposal, then approve it or request changes.",
    adminMessage: "Waiting on the client to respond to the proposal.",
  },
  approved: {
    tab: "estimate",
    actor: "admin",
    clientMessage:
      "Thanks for approving the proposal — we're pricing the work now. Your cost & schedule estimate will arrive by email.",
    adminMessage: "Draft the cost & schedule estimate, then send it to the client.",
  },
  estimate_draft: {
    tab: "estimate",
    actor: "admin",
    clientMessage:
      "We're finalising your cost & schedule estimate. We'll email you when it's ready to review.",
    adminMessage: "Finish the estimate line items and send the estimate to the client.",
  },
  estimate_sent: {
    tab: "estimate",
    actor: "client",
    clientMessage: "Review the cost & schedule estimate, then approve it or let us know.",
    adminMessage: "Waiting on the client to approve the estimate.",
  },
  estimate_approved: {
    tab: "sow",
    actor: "admin",
    clientMessage:
      "Estimate approved — we're preparing your Statement of Work for signature. We'll email you when it's ready.",
    adminMessage: "Generate the Statement of Work from the approved estimate and send it to sign.",
  },
  contract_sent: {
    tab: "sow",
    actor: "client",
    clientMessage: "Read and sign the Statement of Work so we can schedule your project.",
    adminMessage: "Waiting on the client to sign the Statement of Work.",
  },
  signed: {
    tab: "invoices",
    actor: "admin",
    clientMessage:
      "Your Statement of Work is signed. We're scheduling the start date — your first invoice arrives by email.",
    adminMessage: "Confirm the project start date so the invoice schedule is issued.",
  },
  invoicing: {
    tab: "invoices",
    actor: "client",
    clientMessage: "Pay the open invoice to keep your project on schedule.",
    adminMessage: "Waiting on client payment of the open invoice.",
  },
  completed: {
    tab: "invoices",
    actor: "none",
    clientMessage: "This project is complete — nothing further is needed. Thank you for working with us.",
    adminMessage: "This project is complete. No further action is required.",
  },
  declined: {
    tab: "proposal",
    actor: "none",
    clientMessage:
      "This request was closed. Reach out to your BLEXware contact if anything has changed.",
    adminMessage: "This request was declined and closed.",
  },
};

export function getStageGuidance(status: QuoteStatus): StageGuidance {
  return GUIDANCE[status] ?? GUIDANCE.new;
}

export type NextStep = {
  tab: GuidanceTab;
  actor: Actor;
  message: string;
  /** True when the viewer owns the next action. */
  actionable: boolean;
};

export function getNextStep(status: QuoteStatus, audience: Audience): NextStep {
  const guidance = getStageGuidance(status);
  return {
    tab: guidance.tab,
    actor: guidance.actor,
    message: audience === "client" ? guidance.clientMessage : guidance.adminMessage,
    actionable: guidance.actor === audience,
  };
}

const PURPOSE: Record<Audience, Partial<Record<GuidanceTab, string>>> = {
  client: {
    overview: "What you told us about the project, plus any files you attached.",
    proposal: "The scope and approach we recommend — review and respond to it here.",
    estimate: "Cost and schedule for each item in the approved proposal.",
    sow: "The Statement of Work to sign before work begins.",
    invoices: "Payments for this project, issued in instalments.",
  },
  admin: {
    intake: "Everything the client submitted, including attachments.",
    proposal: "Draft, review and send the proposal the client responds to.",
    estimate: "Price each proposal item and release the estimate for approval.",
    sow: "Generate, countersign and track the Statement of Work.",
    invoices: "Issue the instalment schedule and follow payments.",
  },
};

export function getTabPurpose(tab: string, audience: Audience): string | null {
  return PURPOSE[audience][tab as GuidanceTab] ?? null;
}

const EMPTY: Record<Audience, Partial<Record<GuidanceTab, string>>> = {
  client: {
    proposal:
      "Nothing here yet. Your proposal appears once the BLEXware team has prepared and sent it.",
    estimate:
      "Nothing here yet. Your cost & schedule estimate appears after you approve the proposal and the BLEXware team prices the work.",
    sow: "Nothing here yet. Your Statement of Work appears after you approve the estimate and the BLEXware team drafts the agreement.",
    invoices:
      "Nothing here yet. Invoices appear once you sign the Statement of Work and the BLEXware team schedules your start date.",
  },
  admin: {
    proposal: "No draft yet. Generate a proposal draft, review it, then send it to the client.",
    estimate:
      "No estimate yet. Draft one here once the client has approved the proposal (you can start it manually or with AI).",
    sow: "No agreement yet. Generate the Statement of Work once the client approves the estimate.",
    invoices:
      "No invoices yet. They are issued automatically once the client signs the Statement of Work and a start date is confirmed.",
  },
};

export function getTabEmptyState(tab: string, audience: Audience): string | null {
  return EMPTY[audience][tab as GuidanceTab] ?? null;
}
