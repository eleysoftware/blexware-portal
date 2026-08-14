// Structured document model shared by proposals, estimates and SOW agreements.
// Renderers (PDF + DOCX) consume this shape; nothing here is server-only.

export type DocTable = {
  columns: string[];
  rows: string[][];
  /** Right-align every column after the first (money/duration tables). */
  numeric?: boolean;
};

export type DocSection = {
  heading: string;
  level?: 1 | 2;
  body?: string[];
  bullets?: string[];
  table?: DocTable;
  note?: string;
};

export type DocParty = {
  name: string;
  title?: string;
  company?: string;
  email?: string;
  phone?: string;
};

export type DocFact = { label: string; value: string };

export type ProjectDocument = {
  kind: "proposal" | "estimate" | "sow";
  documentNumber?: string;
  title: string;
  subtitle?: string;
  clientName: string;
  date: string;
  preparedFor: DocParty;
  preparedBy: DocParty;
  facts?: DocFact[];
  sections: DocSection[];
  acceptance?: {
    intro?: string[];
    signerName?: string;
    signatureText?: string;
    signedAt?: string;
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
