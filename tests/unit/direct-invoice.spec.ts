import { expect, test } from "@playwright/test";

import { buildInvoiceDoc, buildPaymentPlan, evenSplitRows } from "@/lib/documents/compose";

const invoice = {
  invoice_number: "INV-2026-0007",
  sequence: 1,
  amount_cents: 120_000,
  status: "sent",
  due_date: "2026-09-20",
  issue_date: "2026-09-13",
  description: "Monthly support and hosting — August 2026",
};

const quote = { contact_name: "Tamara West", contact_email: "t@example.com", company: "D&AMT, LLC" };

test("an itemized invoice lists each service and the discounted total", () => {
  const doc = buildInvoiceDoc({
    invoice,
    quote,
    payUrl: "https://blexware.com/invoice/abc",
    lineItems: [
      { label: "Support retainer", amountCents: 90_000 },
      { label: "Hosting", amountCents: 40_000 },
    ],
    subtotalCents: 130_000,
    discountCents: 10_000,
  });
  const section = doc.sections.find((entry) => entry.heading === "Itemized Services");
  expect(section).toBeTruthy();
  const rows = section?.table?.rows ?? [];
  expect(rows[0]?.[0]).toBe("Support retainer");
  expect(rows.at(-1)).toEqual(["Total", "$1,200.00"]);
  expect(rows.some((row) => row[0] === "Discount")).toBe(true);
});

test("an invoice with no line items keeps the plain charges table only", () => {
  const doc = buildInvoiceDoc({ invoice, quote, payUrl: "https://blexware.com/invoice/abc" });
  expect(doc.sections.some((entry) => entry.heading === "Itemized Services")).toBe(false);
  expect(doc.sections[0]?.heading).toBe("Charges");
});

test("a direct invoice split into payments always adds back to the total", () => {
  const rows = evenSplitRows(120_001, 3);
  const plan = buildPaymentPlan("custom", 120_001, rows);
  expect(plan.rows.reduce((sum, row) => sum + row.amountCents, 0)).toBe(120_001);
  expect(plan.rows[0]?.send).toBe("on_sign");
  expect(plan.rows[1]?.send).toBe("manual");
});
