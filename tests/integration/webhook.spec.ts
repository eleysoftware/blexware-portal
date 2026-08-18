import { expect, test } from "@playwright/test";

import {
  cleanupByEmail,
  newRunId,
  playwrightEmail,
  seedPayableInvoice,
  seedPaymentAttempt,
  testDb,
} from "../helpers/db";
import { paymentSucceededPayload, signWebhook } from "../helpers/webhook";

test.describe("Hyperswitch webhook", () => {
  const runId = newRunId();
  const emails: string[] = [];

  test.afterAll(async () => {
    for (const email of emails) await cleanupByEmail(email);
  });

  // 500-without-secret is the handler's boot path when HYPERSWITCH_WEBHOOK_SECRET
  // is unset. This suite always configures a secret so signed events can be verified.

  test("rejects an unsigned payload", async ({ request }) => {
    const response = await request.post("/api/public/hyperswitch/webhook", {
      data: { event_id: "evt_unsigned", event_type: "payment_succeeded" },
    });
    expect(response.status()).toBe(401);
  });

  test("rejects a bad signature", async ({ request }) => {
    const response = await request.post("/api/public/hyperswitch/webhook", {
      headers: { "x-webhook-signature-512": "00".repeat(64) },
      data: { event_id: "evt_bad", event_type: "payment_succeeded" },
    });
    expect(response.status()).toBe(401);
  });

  test("credits a signed payment_succeeded event and ignores duplicates", async ({ request }) => {
    const email = playwrightEmail(runId, "paid");
    emails.push(email);
    const seeded = await seedPayableInvoice({ email, amountCents: 64_000, status: "sent" });
    const providerPaymentId = `pay_${runId}_full`;
    await seedPaymentAttempt({
      invoiceId: seeded.invoice.id as string,
      providerPaymentId,
      amountCents: 64_000,
    });

    const eventId = `evt_${runId}_full`;
    const payload = paymentSucceededPayload({
      eventId,
      paymentId: providerPaymentId,
      amountCents: 64_000,
    });
    const body = JSON.stringify(payload);
    const signature = await signWebhook(body);

    const first = await request.post("/api/public/hyperswitch/webhook", {
      headers: { "content-type": "application/json", "x-webhook-signature-512": signature },
      data: body,
    });
    expect(first.status()).toBe(200);

    const db = testDb();
    const { data: afterFirst } = await db
      .from("invoices")
      .select("status, amount_paid_cents")
      .eq("id", seeded.invoice.id)
      .single();
    expect(afterFirst?.status).toBe("paid");
    expect(Number(afterFirst?.amount_paid_cents)).toBe(64_000);

    const second = await request.post("/api/public/hyperswitch/webhook", {
      headers: { "content-type": "application/json", "x-webhook-signature-512": signature },
      data: body,
    });
    expect(second.status()).toBe(200);

    const { data: afterSecond } = await db
      .from("invoices")
      .select("status, amount_paid_cents")
      .eq("id", seeded.invoice.id)
      .single();
    expect(afterSecond?.status).toBe("paid");
    expect(Number(afterSecond?.amount_paid_cents)).toBe(64_000);
  });

  test("marks an invoice partially paid when the event amount is less than the balance", async ({
    request,
  }) => {
    const email = playwrightEmail(runId, "partial");
    emails.push(email);
    const seeded = await seedPayableInvoice({ email, amountCents: 64_000, status: "sent" });
    const providerPaymentId = `pay_${runId}_part`;
    await seedPaymentAttempt({
      invoiceId: seeded.invoice.id as string,
      providerPaymentId,
      amountCents: 20_000,
    });

    const payload = paymentSucceededPayload({
      eventId: `evt_${runId}_part`,
      paymentId: providerPaymentId,
      amountCents: 20_000,
    });
    const body = JSON.stringify(payload);
    const response = await request.post("/api/public/hyperswitch/webhook", {
      headers: { "content-type": "application/json", "x-webhook-signature-512": await signWebhook(body) },
      data: body,
    });
    expect(response.status()).toBe(200);

    const { data } = await testDb()
      .from("invoices")
      .select("status, amount_paid_cents")
      .eq("id", seeded.invoice.id)
      .single();
    expect(data?.status).toBe("partially_paid");
    expect(Number(data?.amount_paid_cents)).toBe(20_000);
  });
});
