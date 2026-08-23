// Structured document model shared by proposals, estimates and SOW agreements.
// Renderers (PDF + DOCX) consume this shape; nothing here is server-only.

export type DocTableRowTone = "default" | "muted" | "discount" | "total" | "fill";

export type DocTable = {
  columns: string[];
  rows: string[][];
  /** Right-align every column after the first (money/duration tables). */
  numeric?: boolean;
  /** Optional per-data-row fill (header is always the navy-blue band). */
  rowTones?: DocTableRowTone[];
};

export type DocBulletGroup = {
  heading: string;
  bullets: string[];
};

export type DocSection = {
  heading: string;
  level?: 1 | 2 | 3;
  body?: string[];
  bullets?: string[];
  groups?: DocBulletGroup[];
  table?: DocTable;
  note?: string;
  callout?: "info" | "success";
  children?: DocSection[];
};

export type DocParty = {
  name: string;
  title?: string;
  company?: string;
  email?: string;
  phone?: string;
};

export type DocFact = { label: string; value: string };

export type PaymentSend = "on_sign" | "manual" | "interval";
export type PaymentPlanKind = "fifty_fifty" | "installments" | "full" | "custom";

export type PaymentPlanRow = {
  label: string;
  amountCents: number;
  send: PaymentSend;
};

export type PaymentPlan = {
  kind: PaymentPlanKind;
  rows: PaymentPlanRow[];
};

export type ProjectDocument = {
  kind: "proposal" | "estimate" | "sow";
  documentNumber?: string;
  /** Cover title, typically the client company in all caps. */
  title: string;
  subtitle?: string;
  /** Header right-hand side, e.g. "Website Enhancement Proposal". */
  documentTitle?: string;
  /** Smaller cover line under the subtitle, e.g. "Website Enhancement Project". */
  projectLabel?: string;
  clientName: string;
  date: string;
  preparedFor: DocParty;
  preparedBy: DocParty;
  facts?: DocFact[];
  sections: DocSection[];
  paymentPlan?: PaymentPlan;
  acceptance?: {
    intro?: string[];
    signerName?: string;
    signatureText?: string;
    signedAt?: string;
    /** BLEXware countersignature applied when the project is approved to start. */
    countersign?: {
      name: string;
      title?: string;
      signatureText: string;
      signedAt: string;
      startDate?: string;
    };
  };

  confidentialFooter?: boolean;
};

export type EstimateLineItem = {
  label: string;
  amountCents: number;
  note?: string;
  durationLabel?: string;
};

export const BLEX_PREPARED_BY: DocParty = {
  name: "Kam Eley",
  company: "BLEXware",
  phone: "(260) 433-8734",
  email: "quote@blexware.com",
};

export function formatMoney(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

export function runningHeader(doc: ProjectDocument): string {
  const title =
    doc.documentTitle ??
    (doc.kind === "sow" ? "Statement of Work Agreement" : (doc.subtitle ?? "Proposal"));
  return `${doc.clientName} | ${title}`;
}
