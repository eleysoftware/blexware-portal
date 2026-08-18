import { expect, test } from "@playwright/test";

import { computeInvoicePlan } from "../../src/lib/documents/compose";

const from = new Date("2026-01-01T00:00:00.000Z");

test("folds a sub-$600 remainder into a single invoice", () => {
  const plan = computeInvoicePlan(104_000, from);
  expect(plan).toHaveLength(1);
  expect(plan[0]?.amountCents).toBe(104_000);
});

test("splits exact $1,200 into two $600 invoices", () => {
  const plan = computeInvoicePlan(120_000, from);
  expect(plan.map((entry) => entry.amountCents)).toEqual([60_000, 60_000]);
  expect(plan[1]?.dueDate).toBe("2026-01-22");
});

test("puts leftover cents on invoice 1 when there are multiple installments", () => {
  // $1,640 → floor(164000/60000)=2, remainder $440 → $1,040 then $600
  const plan = computeInvoicePlan(164_000, from);
  expect(plan.map((entry) => entry.amountCents)).toEqual([104_000, 60_000]);
});

test("returns no invoices for a zero total", () => {
  expect(computeInvoicePlan(0)).toEqual([]);
});
