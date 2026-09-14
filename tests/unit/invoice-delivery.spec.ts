import { expect, test } from "@playwright/test";

import { buildPaymentPlan, paymentPlanToInvoiceEntries } from "@/lib/documents/compose";

// A custom split leaves later payments without a send date, which is why the
// direct-invoice flow fills one in before saving them as "scheduled" — without
// it the nightly worker would never email payments 2..N.
test("custom split payments keep the full total and only the first is dated", () => {
  const plan = buildPaymentPlan("custom", 420_000, [
    { label: "Payment 1", amountCents: 100_000 },
    { label: "Payment 2", amountCents: 160_000 },
    { label: "Payment 3", amountCents: 160_000 },
  ]);
  const entries = paymentPlanToInvoiceEntries(plan, new Date("2026-09-14T00:00:00Z"));

  expect(entries).toHaveLength(3);
  expect(entries.reduce((sum, entry) => sum + entry.amountCents, 0)).toBe(420_000);
  expect(entries[0]?.scheduledSendAt).toBeTruthy();
  expect(entries[1]?.scheduledSendAt).toBeNull();
});

test("installment plans already carry a send date for every payment", () => {
  const plan = buildPaymentPlan("installments", 360_000);
  const entries = paymentPlanToInvoiceEntries(plan, new Date("2026-09-14T00:00:00Z"));
  expect(entries.length).toBeGreaterThan(1);
  for (const entry of entries) expect(entry.scheduledSendAt).toBeTruthy();
});
