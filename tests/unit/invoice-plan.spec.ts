import { expect, test } from "@playwright/test";

import {
  buildPaymentPlan,
  computeInvoicePlan,
  paymentPlanToInvoiceEntries,
  splitFiftyFifty,
} from "../../src/lib/documents/compose";

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
  const plan = computeInvoicePlan(164_000, from);
  expect(plan.map((entry) => entry.amountCents)).toEqual([104_000, 60_000]);
});

test("returns no invoices for a zero total", () => {
  expect(computeInvoicePlan(0)).toEqual([]);
});

test("splits $1,040 fifty-fifty into $520 / $520", () => {
  expect(splitFiftyFifty(104_000)).toEqual([52_000, 52_000]);
  const plan = buildPaymentPlan("fifty_fifty", 104_000);
  expect(plan.rows.map((row) => row.amountCents)).toEqual([52_000, 52_000]);
  const invoices = paymentPlanToInvoiceEntries(plan, from);
  expect(invoices[0]?.send).toBe("on_sign");
  expect(invoices[1]?.send).toBe("manual");
  expect(invoices[1]?.scheduledSendAt).toBeNull();
});

test("pay in full is a single on-sign invoice", () => {
  const plan = buildPaymentPlan("full", 104_000);
  expect(plan.rows).toEqual([{ label: "Due upon proposal acceptance", amountCents: 104_000, send: "on_sign" }]);
});

test("custom amounts keep the first invoice on sign and the rest manual", () => {
  const plan = buildPaymentPlan("custom", 104_000, [
    { label: "Deposit", amountCents: 40_000 },
    { label: "Balance", amountCents: 64_000 },
  ]);
  expect(plan.rows[0]?.send).toBe("on_sign");
  expect(plan.rows[1]?.send).toBe("manual");
  expect(plan.rows.map((row) => row.amountCents)).toEqual([40_000, 64_000]);
});
