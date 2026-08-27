import {
  BLEX_PREPARED_BY,
  formatMoney,
  type DocSection,
  type EstimateLineItem,
  type PaymentPlan,
  type PaymentPlanKind,
  type PaymentPlanRow,
  type ProjectDocument,
} from "@/lib/documents/types";

export const INSTALLMENT_CENTS = 60000;
export const INVOICE_INTERVAL_DAYS = 14;

export type InvoicePlanEntry = {
  sequence: number;
  amountCents: number;
  dueDate: string | null;
  scheduledSendAt: string | null;
  send: PaymentPlanRow["send"];
  label: string;
};

/**
 * $600 installments. Any remainder is folded into the first invoice, which is
 * issued immediately; the rest go out every 14 days.
 */
export function computeInvoicePlan(totalCents: number, from = new Date()): InvoicePlanEntry[] {
  const plan = buildPaymentPlan("installments", totalCents);
  return paymentPlanToInvoiceEntries(plan, from);
}

export function splitFiftyFifty(totalCents: number): [number, number] {
  const first = Math.floor(Math.max(0, Math.round(totalCents)) / 2);
  return [first, Math.max(0, Math.round(totalCents)) - first];
}

/** Supported invoice counts for the schedule builder. */
export const SPLIT_COUNTS = [1, 2, 3, 4, 5, 6, 9, 12] as const;

/**
 * Splits a total into `count` even invoices. Rounding drift lands on the first
 * invoice so the amounts always add back up to the total exactly.
 */
export function evenSplitRows(
  totalCents: number,
  count: number,
): { label: string; amountCents: number }[] {
  const total = Math.max(0, Math.round(totalCents));
  const parts = Math.max(1, Math.floor(count));
  const base = Math.floor(total / parts);
  const remainder = total - base * parts;
  return Array.from({ length: parts }, (_, index) => ({
    label: parts === 1 ? "Due upon signature" : `Invoice ${index + 1} of ${parts}`,
    amountCents: index === 0 ? base + remainder : base,
  }));
}

export function buildPaymentPlan(
  kind: PaymentPlanKind,
  totalCents: number,
  custom?: { label: string; amountCents: number }[],
): PaymentPlan {
  const total = Math.max(0, Math.round(totalCents));

  if (kind === "full") {
    return {
      kind,
      rows: [{ label: "Due upon proposal acceptance", amountCents: total, send: "on_sign" }],
    };
  }

  if (kind === "fifty_fifty") {
    const [first, second] = splitFiftyFifty(total);
    return {
      kind,
      rows: [
        { label: "50% Upon Proposal Acceptance", amountCents: first, send: "on_sign" },
        { label: "50% Upon Project Completion", amountCents: second, send: "manual" },
      ],
    };
  }

  if (kind === "custom") {
    const rows = (custom ?? []).filter((row) => Number.isFinite(row.amountCents) && row.amountCents > 0);
    return {
      kind,
      rows: rows.map((row, index) => ({
        label: row.label.trim() || `Invoice ${index + 1}`,
        amountCents: Math.round(row.amountCents),
        send: index === 0 ? "on_sign" : "manual",
      })),
    };
  }

  const safeTotal = total;
  if (safeTotal === 0) return { kind: "installments", rows: [] };
  const count = Math.max(1, Math.floor(safeTotal / INSTALLMENT_CENTS));
  const remainder = safeTotal - count * INSTALLMENT_CENTS;
  const rows: PaymentPlanRow[] = [];
  for (let index = 0; index < count; index += 1) {
    rows.push({
      label: index === 0 ? "Invoice 1 — due at project start" : `Invoice ${index + 1}`,
      amountCents: INSTALLMENT_CENTS + (index === 0 ? remainder : 0),
      send: index === 0 ? "on_sign" : "interval",
    });
  }
  return { kind: "installments", rows };
}

export function paymentPlanToInvoiceEntries(plan: PaymentPlan, from = new Date()): InvoicePlanEntry[] {
  return plan.rows.map((row, index) => {
    if (row.send === "interval") {
      const sendAt = new Date(from.getTime() + index * INVOICE_INTERVAL_DAYS * 86_400_000);
      const due = new Date(sendAt.getTime() + 7 * 86_400_000);
      return {
        sequence: index + 1,
        amountCents: row.amountCents,
        dueDate: due.toISOString().slice(0, 10),
        scheduledSendAt: sendAt.toISOString(),
        send: row.send,
        label: row.label,
      };
    }
    if (row.send === "on_sign") {
      const due = new Date(from.getTime() + 7 * 86_400_000);
      return {
        sequence: index + 1,
        amountCents: row.amountCents,
        dueDate: due.toISOString().slice(0, 10),
        scheduledSendAt: from.toISOString(),
        send: row.send,
        label: row.label,
      };
    }
    return {
      sequence: index + 1,
      amountCents: row.amountCents,
      dueDate: null,
      scheduledSendAt: null,
      send: row.send,
      label: row.label,
    };
  });
}

function paymentPlanFromDoc(doc: ProjectDocument | undefined, totalCents: number): PaymentPlan {
  if (doc?.paymentPlan?.rows?.length) return doc.paymentPlan;
  return buildPaymentPlan("installments", totalCents);
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
      const hashes = heading[1]!.length;
      current = {
        heading: heading[2]!.replace(/[*_`]/g, ""),
        level: hashes >= 3 ? 3 : hashes === 2 ? 2 : 1,
      };
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

export function sectionsToMarkdown(sections: DocSection[], depth = 2): string {
  return sections
    .map((section) => {
      const hashes = "#".repeat(Math.min(3, (section.level ?? 1) + depth - 1));
      const parts = [
        `${hashes} ${section.heading}`,
        ...(section.body ?? []),
        ...(section.groups ?? []).flatMap((group) => [
          `**${group.heading}**`,
          ...group.bullets.map((bullet) => `- ${bullet}`),
        ]),
        ...(section.bullets ?? []).map((bullet) => `- ${bullet}`),
        section.note ?? "",
        section.children ? sectionsToMarkdown(section.children, depth + 1) : "",
      ];
      return parts.filter(Boolean).join("\n\n");
    })
    .join("\n\n");
}

export function buildProposalDocFromMarkdown(input: {
  markdown: string;
  clientName: string;
  clientCompany?: string | null;
  clientEmail: string;
  clientPhone?: string | null;
  projectType: string;
  quoteNumber: string;
  documentTitle?: string;
}): ProjectDocument {
  const documentTitle = input.documentTitle?.trim() || `${input.projectType} Proposal`;
  return {
    kind: "proposal",
    documentNumber: input.quoteNumber,
    title: (input.clientCompany || input.clientName).toUpperCase(),
    subtitle: documentTitle,
    documentTitle,
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
  paymentPlan?: PaymentPlan;
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
  const discountRow = totals.discountCents > 0;
  return {
    heading: "Project Investment & Pricing",
    body: ["The pricing below reflects the estimated effort required to complete each phase of work."],
    table: {
      columns: ["Project Phase", "Investment"],
      numeric: true,
      rows: [
        ...totals.lineItems.map((item) => [
          item.note ? `${item.label}  ${item.note}` : item.label,
          formatMoney(item.amountCents),
        ]),
        ["Project Subtotal", formatMoney(totals.subtotalCents)],
        ...(discountRow ? [[totals.discountLabel ?? "Discount", `–${formatMoney(totals.discountCents)}`]] : []),
        ["Total Project Investment", formatMoney(totals.totalCents)],
      ],
      rowTones: [
        ...totals.lineItems.map(() => "default" as const),
        "muted",
        ...(discountRow ? (["discount"] as const) : []),
        "total",
      ],
    },
  };
}

function scheduleSection(totals: EstimateTotals): DocSection | null {
  const rows = totals.lineItems
    .filter((item) => item.durationLabel)
    .map((item) => [item.label.replace(/^Phase \d+\s+[–-]\s+/, ""), item.durationLabel!]);
  if (!rows.length && !totals.durationNote) return null;
  return {
    heading: "Project Schedule",
    children: [
      ...(totals.durationNote
        ? [
            {
              heading: "Estimated Project Duration",
              level: 3 as const,
              body: [totals.durationNote],
            },
          ]
        : []),
      ...(rows.length
        ? [
            {
              heading: "Estimated Timeline by Phase",
              level: 3 as const,
              table: { columns: ["Project Phase", "Estimated Duration"], rows },
            },
          ]
        : []),
    ],
  };
}

export function paymentSection(plan: PaymentPlan, totalCents: number): DocSection {
  const body =
    plan.kind === "fifty_fifty"
      ? [
          "The project investment will be paid according to the following schedule:",
          "The final payment is due upon completion of the approved project scope and prior to final deployment of the completed enhancements.",
          "Any work requested outside the approved scope of this proposal may require a separate estimate and written approval before implementation.",
        ]
      : plan.kind === "full"
        ? [
            `The project investment of ${formatMoney(totalCents)} is due in full upon proposal acceptance.`,
            "Work begins once the invoice is paid. Invoices are payable online by card through the BLEXware client portal.",
          ]
        : [
            `The project investment of ${formatMoney(totalCents)} is invoiced in installments of ${formatMoney(
              INSTALLMENT_CENTS,
            )}, with any remainder added to the first invoice. Work begins once the first invoice is paid; subsequent invoices are issued every ${INVOICE_INTERVAL_DAYS} days until the balance is paid in full.`,
            "Invoices are payable online by card through the BLEXware client portal.",
          ];

  return {
    heading: "Payment Terms",
    body,
    table: {
      columns: ["", "Amount"],
      numeric: true,
      rows: plan.rows.map((row) => [row.label, formatMoney(row.amountCents)]),
      rowTones: plan.rows.map(() => (plan.kind === "fifty_fifty" ? "fill" : "default")),
    },
  };
}

function replaceOrAppendSection(sections: DocSection[], heading: RegExp, next: DocSection | null): DocSection[] {
  const without = sections.filter((section) => !heading.test(section.heading));
  return next ? [...without, next] : without;
}

/** Proposal document + priced/scheduled sections = estimated proposal. */
export function buildEstimateDoc(base: ProjectDocument, totals: EstimateTotals): ProjectDocument {
  const paymentPlan = totals.paymentPlan ?? paymentPlanFromDoc(base, totals.totalCents);
  const keep = base.sections.filter(
    (section) => !/investment|pricing|payment terms|project schedule/i.test(section.heading),
  );
  const schedule = scheduleSection(totals);

  return {
    ...base,
    kind: "estimate",
    documentTitle: base.documentTitle,
    subtitle: `${base.subtitle ?? base.documentTitle ?? "Project Proposal"} — Cost & Schedule Estimate`,
    paymentPlan,
    facts: [
      { label: "Total Project Investment", value: formatMoney(totals.totalCents) },
      ...(totals.durationNote ? [{ label: "Estimated Duration", value: totals.durationNote }] : []),
    ],
    sections: [
      ...keep,
      pricingSection(totals),
      ...(schedule ? [schedule] : []),
      paymentSection(paymentPlan, totals.totalCents),
    ],
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
  input: { agreementNumber: string; totalCents: number; paymentPlan?: PaymentPlan },
): ProjectDocument {
  const paymentPlan = input.paymentPlan ?? paymentPlanFromDoc(estimateDoc, input.totalCents);
  const terms: DocSection = {
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
  };

  const withoutTerms = estimateDoc.sections.filter((section) => !/agreement terms/i.test(section.heading));
  const sections = replaceOrAppendSection(withoutTerms, /payment terms/i, paymentSection(paymentPlan, input.totalCents));

  return {
    ...estimateDoc,
    kind: "sow",
    documentNumber: input.agreementNumber,
    documentTitle: "Statement of Work Agreement",
    subtitle: "Statement of Work Agreement",
    paymentPlan,
    sections: [...sections, terms],
    acceptance: {
      intro: [
        "By signing below, the Client accepts this Statement of Work and authorizes BLEXware to begin work according to the scope, schedule and payment terms described herein.",
      ],
      signerName: estimateDoc.preparedFor.name,
    },
  };
}

export function buildInvoiceDoc(input: {
  invoice: {
    invoice_number: string;
    sequence: number;
    amount_cents: number;
    amount_paid_cents?: number | null;
    status: string;
    due_date?: string | null;
    issue_date?: string | null;
    description?: string | null;
  };
  quote: {
    contact_name: string;
    contact_email: string;
    company?: string | null;
    quote_number?: string | null;
  };
  agreement?: { agreement_number: string; total_cents: number } | null;
  invoiceCount?: number;
  payUrl: string;
}): ProjectDocument {
  const { invoice, quote, agreement, invoiceCount, payUrl } = input;
  const total = Number(invoice.amount_cents);
  const paid = Math.max(0, Number(invoice.amount_paid_cents ?? 0));
  const balance = Math.max(0, total - paid);
  const paidInFull = invoice.status === "paid" || balance <= 0;
  const clientName = quote.company?.trim() || quote.contact_name;

  const facts: DocFact[] = [
    { label: "Invoice number", value: invoice.invoice_number },
    ...(agreement ? [{ label: "Agreement", value: agreement.agreement_number }] : []),
    ...(quote.quote_number ? [{ label: "Quote", value: quote.quote_number }] : []),
    { label: "Issue date", value: invoice.issue_date ?? "—" },
    { label: "Due date", value: invoice.due_date ?? "Due on receipt" },
    ...(invoiceCount && invoiceCount > 1
      ? [{ label: "Installment", value: `${invoice.sequence} of ${invoiceCount}` }]
      : []),
  ];

  const paymentLine = agreement
    ? `${
        invoiceCount && invoiceCount > 1
          ? `Installment ${invoice.sequence} of ${invoiceCount} `
          : ""
      }toward agreement ${agreement.agreement_number} (${formatMoney(
        Number(agreement.total_cents),
      )} project total)`
    : `Project services — installment ${invoice.sequence}`;

  const sections: DocSection[] = [
    {
      heading: "Charges",
      table: {
        headers: ["Description", "Amount"],
        rows: [
          [
            invoice.description?.trim() || `Professional services — ${paymentLine}`,
            formatMoney(total),
          ],
          ...(paid > 0
            ? [
                ["Payments received to date", `\u2212${formatMoney(paid)}`],
                [paidInFull ? "Balance" : "Balance due", formatMoney(balance)],
              ]
            : []),
        ],
      },
    },
    {
      heading: paidInFull ? "Payment Status" : "How to Pay",
      body: [
        paidInFull
          ? "This invoice has been paid in full. No further action is needed — thank you for your business."
          : `${formatMoney(balance)} is due ${
              invoice.due_date ? `by ${invoice.due_date}` : "on receipt"
            }. Pay securely online by bank transfer (ACH) or card using the private link below.`,
        ...(paidInFull ? [] : [payUrl]),
      ],
      ...(paidInFull
        ? {}
        : {
            note: "The link is private to you. Questions about this invoice? Just reply to the email it arrived in.",
          }),
    },
  ];

  return {
    kind: "invoice",
    documentNumber: invoice.invoice_number,
    title: clientName.toUpperCase(),
    subtitle: "Invoice",
    documentTitle: paidInFull ? "Invoice — Paid in Full" : "Invoice",
    clientName,
    date: new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" }),
    preparedFor: {
      name: quote.contact_name,
      company: quote.company ?? undefined,
      email: quote.contact_email,
    },
    preparedBy: BLEX_PREPARED_BY,
    facts,
    sections,
    confidentialFooter: true,
  };
}
