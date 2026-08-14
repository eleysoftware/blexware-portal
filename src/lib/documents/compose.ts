import {
  BLEX_PREPARED_BY,
  formatMoney,
  type DocSection,
  type EstimateLineItem,
  type ProjectDocument,
} from "@/lib/documents/types";

export const INSTALLMENT_CENTS = 60000;
export const INVOICE_INTERVAL_DAYS = 14;

export type InvoicePlanEntry = {
  sequence: number;
  amountCents: number;
  dueDate: string; // YYYY-MM-DD
  scheduledSendAt: string; // ISO
};

/**
 * $600 installments. Any remainder is folded into the first invoice, which is
 * issued immediately; the rest go out every 14 days.
 */
export function computeInvoicePlan(totalCents: number, from = new Date()): InvoicePlanEntry[] {
  const safeTotal = Math.max(0, Math.round(totalCents));
  if (safeTotal === 0) return [];

  const count = Math.max(1, Math.floor(safeTotal / INSTALLMENT_CENTS));
  const remainder = safeTotal - count * INSTALLMENT_CENTS;

  const entries: InvoicePlanEntry[] = [];
  for (let index = 0; index < count; index += 1) {
    const sendAt = new Date(from.getTime() + index * INVOICE_INTERVAL_DAYS * 86_400_000);
    const due = new Date(sendAt.getTime() + 7 * 86_400_000);
    entries.push({
      sequence: index + 1,
      amountCents: INSTALLMENT_CENTS + (index === 0 ? remainder : 0),
      dueDate: due.toISOString().slice(0, 10),
      scheduledSendAt: sendAt.toISOString(),
    });
  }
  return entries;
}

/** Turns markdown-ish AI output into the structured document model. */
export function markdownToSections(markdown: string): DocSection[] {
  const sections: DocSection[] = [];
  let current: DocSection | null = null;

  for (const rawLine of markdown.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      if (current) sections.push(current);
      current = { heading: heading[2]!.replace(/[*_`]/g, ""), level: heading[1]!.length >= 3 ? 2 : 1 };
      continue;
    }
    if (!current) current = { heading: "Overview" };
    const bullet = /^[-*•]\s+(.*)$/.exec(line);
    if (bullet) {
      current.bullets = [...(current.bullets ?? []), bullet[1]!.replace(/[*_`]/g, "")];
    } else {
      current.body = [...(current.body ?? []), line.replace(/[*_`#]/g, "")];
    }
  }
  if (current) sections.push(current);
  return sections;
}

export function buildProposalDocFromMarkdown(input: {
  markdown: string;
  clientName: string;
  clientCompany?: string | null;
  clientEmail: string;
  clientPhone?: string | null;
  projectType: string;
  quoteNumber: string;
}): ProjectDocument {
  return {
    kind: "proposal",
    documentNumber: input.quoteNumber,
    title: (input.clientCompany || input.clientName).toUpperCase(),
    subtitle: `${input.projectType} Proposal`,
    clientName: input.clientCompany || input.clientName,
    date: new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" }),
    preparedFor: {
      name: input.clientName,
      company: input.clientCompany ?? undefined,
      email: input.clientEmail,
      phone: input.clientPhone ?? undefined,
    },
    preparedBy: BLEX_PREPARED_BY,
    confidentialFooter: true,
    sections: markdownToSections(input.markdown),
    acceptance: {
      intro: [
        "This proposal represents the agreed scope of work for the project described above.",
        "Acceptance authorizes BLEXware to prepare a cost and schedule estimate for this scope.",
      ],
      signerName: input.clientName,
    },
  };
}

export type EstimateTotals = {
  lineItems: EstimateLineItem[];
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  discountLabel?: string;
  durationNote?: string;
};

export function calculateTotals(
  lineItems: EstimateLineItem[],
  discountCents: number,
): { subtotalCents: number; discountCents: number; totalCents: number } {
  const subtotalCents = lineItems.reduce((sum, item) => sum + Math.round(item.amountCents), 0);
  const discount = Math.max(0, Math.min(Math.round(discountCents), subtotalCents));
  return { subtotalCents, discountCents: discount, totalCents: subtotalCents - discount };
}

function pricingSection(totals: EstimateTotals): DocSection {
  return {
    heading: "Project Investment & Pricing",
    body: ["The pricing below reflects the estimated effort required to complete each phase of work."],
    table: {
      columns: ["Project Phase", "Investment"],
      numeric: true,
      rows: [
        ...totals.lineItems.map((item) => [
          item.note ? `${item.label} (${item.note})` : item.label,
          formatMoney(item.amountCents),
        ]),
        ["Project Subtotal", formatMoney(totals.subtotalCents)],
        ...(totals.discountCents > 0
          ? [[totals.discountLabel ?? "Discount", `–${formatMoney(totals.discountCents)}`]]
          : []),
        ["Total Project Investment", formatMoney(totals.totalCents)],
      ],
    },
  };
}

function scheduleSection(totals: EstimateTotals): DocSection | null {
  const rows = totals.lineItems
    .filter((item) => item.durationLabel)
    .map((item) => [item.label, item.durationLabel!]);
  if (!rows.length && !totals.durationNote) return null;
  return {
    heading: "Project Schedule",
    body: totals.durationNote ? [totals.durationNote] : [],
    ...(rows.length ? { table: { columns: ["Project Phase", "Estimated Duration"], rows } } : {}),
  };
}

function paymentSection(totalCents: number): DocSection {
  const plan = computeInvoicePlan(totalCents);
  return {
    heading: "Payment Terms",
    body: [
      `The project investment of ${formatMoney(totalCents)} is invoiced in installments of ${formatMoney(
        INSTALLMENT_CENTS,
      )}, with any remainder added to the first invoice. Work begins once the first invoice is paid; subsequent invoices are issued every ${INVOICE_INTERVAL_DAYS} days until the balance is paid in full.`,
      "Invoices are payable online by card through the BLEXware client portal.",
    ],
    table: {
      columns: ["Invoice", "Amount"],
      numeric: true,
      rows: plan.map((entry) => [
        entry.sequence === 1 ? "Invoice 1 — due at project start" : `Invoice ${entry.sequence}`,
        formatMoney(entry.amountCents),
      ]),
    },
  };
}

/** Proposal document + priced/scheduled sections = estimated proposal. */
export function buildEstimateDoc(base: ProjectDocument, totals: EstimateTotals): ProjectDocument {
  const keep = base.sections.filter(
    (section) =>
      !/investment|pricing|payment terms|project schedule/i.test(section.heading),
  );
  const schedule = scheduleSection(totals);

  return {
    ...base,
    kind: "estimate",
    subtitle: `${base.subtitle ?? "Project Proposal"} — Cost & Schedule Estimate`,
    facts: [
      { label: "Total Project Investment", value: formatMoney(totals.totalCents) },
      ...(totals.durationNote ? [{ label: "Estimated Duration", value: totals.durationNote }] : []),
    ],
    sections: [...keep, pricingSection(totals), ...(schedule ? [schedule] : []), paymentSection(totals.totalCents)],
    acceptance: {
      intro: [
        "This estimated proposal represents the agreed scope, cost and schedule for the project.",
        "Approval authorizes BLEXware to prepare the Statement of Work agreement for signature.",
      ],
      signerName: base.preparedFor.name,
    },
  };
}

/** Estimated proposal + contractual terms = SOW agreement. */
export function buildSowDoc(
  estimateDoc: ProjectDocument,
  input: { agreementNumber: string; totalCents: number },
): ProjectDocument {
  const terms: DocSection[] = [
    {
      heading: "Agreement Terms",
      body: [
        `This Statement of Work ("SOW") is entered into between BLEXware ("Provider") and ${estimateDoc.preparedFor.company ?? estimateDoc.preparedFor.name} ("Client") and incorporates the scope, schedule and pricing described above.`,
      ],
      bullets: [
        `Total contract value: ${formatMoney(input.totalCents)}, invoiced per the payment schedule above.`,
        "Work begins after the first invoice is paid in full.",
        "Requests outside the approved scope require a separate written estimate and approval.",
        "Client provides timely feedback, approvals, content and third-party access needed to complete the work.",
        "Deliverables are owned by the Client upon receipt of final payment; BLEXware retains rights to its pre-existing tools and components.",
        "Either party may terminate with written notice; the Client pays for work completed to the termination date.",
        "Each party keeps the other's non-public information confidential.",
        "Provider warrants professional workmanship; the Provider's total liability is limited to fees paid under this SOW.",
        "This SOW is governed by the laws of the State of Indiana.",
      ],
    },
  ];

  return {
    ...estimateDoc,
    kind: "sow",
    documentNumber: input.agreementNumber,
    subtitle: "Statement of Work Agreement",
    sections: [...estimateDoc.sections, ...terms],
    acceptance: {
      intro: [
        "By signing below, the Client accepts this Statement of Work and authorizes BLEXware to begin work according to the scope, schedule and payment terms described herein.",
      ],
      signerName: estimateDoc.preparedFor.name,
    },
  };
}
