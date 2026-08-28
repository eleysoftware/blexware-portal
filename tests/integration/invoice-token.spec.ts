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

  test("shows the remaining project schedule after the first installment", async ({ page }) => {
    const email = playwrightEmail(runId, "schedule");
    emails.push(email);
    const seeded = await seedPayableInvoice({ email, status: "paid", amountCents: 100_000 });
    const { testDb } = await import("../helpers/db");
    const db = testDb();
    await db.from("agreements").update({
      total_cents: 460_000,
      doc: {
        paymentPlan: {
          kind: "custom",
          rows: [
            { label: "Project start", amountCents: 100_000, send: "on_sign" },
            ...Array.from({ length: 6 }, (_, index) => ({
              label: `Installment ${index + 2}`,
              amountCents: 60_000,
              send: "interval",
            })),
          ],
        },
      },
    }).eq("id", seeded.agreementId);
    await db.from("invoices").update({ amount_paid_cents: 100_000 }).eq("id", seeded.invoice.id);

    await page.goto(`/invoice/${seeded.invoice.pay_token}`);
    await expect(page.getByTestId("project-balance")).toContainText("$3,600", { timeout: 20_000 });
    await expect(page.getByText("Installment 7")).toBeVisible();
  });
});
