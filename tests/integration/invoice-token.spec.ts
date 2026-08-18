import { expect, test } from "@playwright/test";

import { cleanupByEmail, newRunId, playwrightEmail, seedPayableInvoice } from "../helpers/db";

test.describe("Invoice pay token", () => {
  const runId = newRunId();
  const emails: string[] = [];

  test.afterAll(async () => {
    for (const email of emails) await cleanupByEmail(email);
  });

  test("hides scheduled, void, and cancelled invoices", async ({ page }) => {
    for (const status of ["scheduled", "void", "cancelled"] as const) {
      const email = playwrightEmail(runId, status);
      emails.push(email);
      const seeded = await seedPayableInvoice({ email, status });
      await page.goto(`/invoice/${seeded.invoice.pay_token}`);
      await expect(page.getByTestId("invoice-inactive")).toBeVisible({ timeout: 20_000 });
      await expect(page.getByTestId("invoice-pay")).toHaveCount(0);
    }
  });

  test("rejects a malformed token", async ({ page }) => {
    await page.goto("/invoice/not-a-valid-token");
    await expect(page.getByTestId("invoice-inactive")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("invoice-pay")).toHaveCount(0);
  });

  test("shows a sent invoice", async ({ page }) => {
    const email = playwrightEmail(runId, "visible");
    emails.push(email);
    const seeded = await seedPayableInvoice({ email, status: "sent", amountCents: 60_000 });
    await page.goto(`/invoice/${seeded.invoice.pay_token}`);
    await expect(page.getByTestId("invoice-balance")).toContainText("$600", { timeout: 20_000 });
    await expect(page.getByTestId("invoice-status")).toBeVisible();
  });
});
