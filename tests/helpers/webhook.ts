import { webhookSecret } from "./env";

export async function signWebhook(body: string, secret = webhookSecret()): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(mac))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function paymentSucceededPayload(input: {
  eventId: string;
  paymentId: string;
  amountCents: number;
  status?: string;
}) {
  return {
    event_id: input.eventId,
    event_type: "payment_succeeded",
    content: {
      object: {
        payment_id: input.paymentId,
        status: input.status ?? "succeeded",
        amount: input.amountCents,
        amount_received: input.amountCents,
        payment_method: "card",
        payment_method_type: "card",
        connector: "helcim",
        connector_transaction_id: `txn_${input.eventId.slice(0, 8)}`,
      },
    },
  };
}
