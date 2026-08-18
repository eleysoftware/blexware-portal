import { expect, test } from "@playwright/test";

import { verifyWebhookSignature } from "../../src/lib/payments/hyperswitch.server";
import { signWebhook } from "../helpers/webhook";

const secret = "unit-test-webhook-secret";
const body = JSON.stringify({ event_id: "evt_1", event_type: "payment_succeeded" });

test("accepts a matching SHA-512 signature", async () => {
  const signature = await signWebhook(body, secret);
  await expect(verifyWebhookSignature(body, signature, secret, "SHA-512")).resolves.toBe(true);
});

test("rejects a tampered body", async () => {
  const signature = await signWebhook(body, secret);
  await expect(
    verifyWebhookSignature(`${body} `, signature, secret, "SHA-512"),
  ).resolves.toBe(false);
});

test("rejects an empty signature", async () => {
  await expect(verifyWebhookSignature(body, "", secret, "SHA-512")).resolves.toBe(false);
});
