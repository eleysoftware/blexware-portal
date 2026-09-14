import { expect, test } from "@playwright/test";

import { buildPaymentPlan, paymentPlanToInvoiceEntries } from "@/lib/documents/compose";

// Split bills must carry a send date for every payment after the first, or the
// nightly worker never mails them and the client only ever sees payment 1.
test("every payment after the first has a send date the cron job can pick up", () => {
  const plan = buildPaymentPlan({
    totalCents: 420_000,
    kind: "custom",
    customPayments: [
      { label: "Payment 1", amountCents: 100_000 },
      { label: "Payment 2", amountCents: 160_000 },
      { label: "Payment 3", amountCents: 160_000 },
    ],
  });
  const entries = paymentPlanToInvoiceEntries(plan, new Date("2026-09-14T00:00:00Z"));

  expect(entries).toHaveLength(3);
  expect(entries.reduce((sum, entry) => sum + entry.amountCents, 0)).toBe(420_000);
  for (const entry of entries.slice(1)) {
    expect(entry.scheduledSendAt).toBeTruthy();
  }
});
