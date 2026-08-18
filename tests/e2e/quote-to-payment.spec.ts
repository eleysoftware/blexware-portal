import { expect, test } from "@playwright/test";

import {
  cleanupByEmail,
  createConfirmedClient,
  getInvoiceByQuoteId,
  getQuoteByEmail,
  insertDraftProposal,
  newRunId,
  playwrightEmail,
  seedPaymentAttempt,
} from "../helpers/db";
import { expectToast, signInAs } from "../helpers/auth";
import { ensureTestAdmin } from "../helpers/db";
import { TEST_CLIENT_PASSWORD } from "../helpers/env";
import { fillQuoteWizard } from "../helpers/quote-form";
import { paymentSucceededPayload, signWebhook } from "../helpers/webhook";

const AUTH_FILE = "tests/.auth/admin.json";
const PROPOSAL = `# Executive Summary
Playwright will verify the BLEXware quote-to-invoice path.

# Timeline
Four weeks from signed SOW to first delivery.
`;

test.describe.configure({ mode: "serial" });

test("quote through invoice payment", async ({ browser, request }) => {
  const runId = newRunId();
  const email = playwrightEmail(runId);
  const adminContext = await browser.newContext({ storageState: AUTH_FILE });
  const clientContext = await browser.newContext();
  const admin = await adminContext.newPage();
  const client = await clientContext.newPage();

  try {
    await fillQuoteWizard(client, { email, attachPdf: true });
    await expect(client.getByTestId("quote-number")).toContainText(/BLX-/);

    const quote = await getQuoteByEmail(email);
    expect(quote?.id).toBeTruthy();
    await insertDraftProposal(quote!.id, PROPOSAL);

    await admin.goto(`/admin/quotes/${quote!.id}`);
    await admin.waitForURL(/\/(admin|auth)/, { timeout: 20_000 });
    if (admin.url().includes("/auth")) {
      const credentials = await ensureTestAdmin();
      await signInAs(admin, { ...credentials, dest: "/admin" });
      await admin.goto(`/admin/quotes/${quote!.id}`);
    }
    await expect(admin.getByRole("heading", { name: "Proposal draft" })).toBeVisible({
      timeout: 20_000,
    });
    await expect(admin.getByTestId("proposal-content")).toBeVisible({ timeout: 20_000 });
    await admin.getByTestId("proposal-content").fill(PROPOSAL);
    await admin.getByTestId("proposal-save").click();
    await expectToast(admin, /Draft saved/);
    await admin.getByTestId("proposal-send").click();
    await expectToast(admin, /Proposal emailed/i, 60_000);

    await createConfirmedClient(email, TEST_CLIENT_PASSWORD);
    await signInAs(client, { email, password: TEST_CLIENT_PASSWORD, dest: "/portal" });
    await client.goto(`/portal/quotes/${quote!.id}`);
    await expect(client.getByTestId("proposal-approve")).toBeVisible({ timeout: 20_000 });
    await client.getByTestId("proposal-approve").click();
    await expectToast(client, /your response has been recorded/i);

    await admin.reload();
    await expect(admin.getByTestId("estimate-line-label")).toBeVisible({ timeout: 20_000 });
    await admin.getByTestId("estimate-line-label").fill("Portal build");
    await admin.getByTestId("estimate-line-amount").fill("1040");
    await admin.getByTestId("estimate-save").click();
    await expectToast(admin, /Estimate saved as a draft/);
    await admin.getByTestId("estimate-send").click();
    await expectToast(admin, /Estimate emailed/i, 60_000);

    await client.reload();
    await expect(client.getByTestId("estimate-approve")).toBeVisible({ timeout: 20_000 });
    await client.getByTestId("estimate-approve").click();
    await expectToast(client, /Estimate approved/i);

    await admin.reload();
    await expect(admin.getByTestId("sow-send")).toBeVisible({ timeout: 20_000 });
    await admin.getByTestId("sow-send").click();
    await expectToast(admin, /SOW sent for signature/i, 60_000);

    await client.reload();
    await expect(client.getByTestId("sow-signature")).toBeVisible({ timeout: 20_000 });
    await client.getByTestId("sow-signature").fill("Playwright Client");
    await client.getByTestId("sow-consent").click();
    await client.getByTestId("sow-sign").click();
    await expectToast(client, /Signed — your first invoice/i, 60_000);

    await expect(async () => {
      const invoice = await getInvoiceByQuoteId(quote!.id);
      expect(invoice?.pay_token).toBeTruthy();
    }).toPass({ timeout: 20_000 });

    const invoice = await getInvoiceByQuoteId(quote!.id);
    expect(invoice).toBeTruthy();
    if (invoice!.status === "scheduled") {
      await admin.reload();
      await admin.getByTestId("invoice-send-now").click();
      await expectToast(admin, /Invoice sent/);
    }

    const payToken = invoice!.pay_token as string;
    const amountCents = Number(invoice!.amount_cents);
    const providerPaymentId = `pay_e2e_${runId}`;
    await seedPaymentAttempt({
      invoiceId: invoice!.id as string,
      providerPaymentId,
      amountCents,
    });

    const payload = paymentSucceededPayload({
      eventId: `evt_e2e_${runId}`,
      paymentId: providerPaymentId,
      amountCents,
    });
    const body = JSON.stringify(payload);
    const webhook = await request.post("/api/public/hyperswitch/webhook", {
      headers: {
        "content-type": "application/json",
        "x-webhook-signature-512": await signWebhook(body),
      },
      data: body,
    });
    expect(webhook.status()).toBe(200);

    await client.goto(`/invoice/${payToken}`);
    await expect(client.getByTestId("invoice-status")).toContainText(/Paid/i, { timeout: 20_000 });
    await expect(client.getByTestId("invoice-balance")).toContainText("$0");
  } finally {
    await adminContext.close();
    await clientContext.close();
    await cleanupByEmail(email);
  }
});
