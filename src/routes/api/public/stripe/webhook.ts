import { createFileRoute } from "@tanstack/react-router";

/** Stripe signature verification (v1 scheme, HMAC-SHA256 over `${t}.${payload}`). */
async function verifyStripeSignature(payload: string, header: string, secret: string) {
  const parts = Object.fromEntries(
    header.split(",").map((part) => {
      const [key, value] = part.split("=");
      return [key ?? "", value ?? ""];
    }),
  ) as Record<string, string>;

  const timestamp = parts["t"];
  const signature = parts["v1"];
  if (!timestamp || !signature) return false;

  // Reject replays older than five minutes.
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${payload}`));
  const expected = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  if (expected.length !== signature.length) return false;
  let mismatch = 0;
  for (let index = 0; index < expected.length; index += 1) {
    mismatch |= expected.charCodeAt(index) ^ signature.charCodeAt(index);
  }
  return mismatch === 0;
}

export const Route = createFileRoute("/api/public/stripe/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["STRIPE_WEBHOOK_SECRET"];
        if (!secret) return new Response("Not configured", { status: 500 });

        const signature = request.headers.get("stripe-signature") ?? "";
        const body = await request.text();
        if (!(await verifyStripeSignature(body, signature, secret))) {
          return new Response("Invalid signature", { status: 401 });
        }

        const event = JSON.parse(body) as {
          type: string;
          data: {
            object: {
              id: string;
              amount_total?: number;
              payment_intent?: string;
              metadata?: Record<string, string>;
            };
          };
        };

        if (event.type === "checkout.session.completed") {
          const session = event.data.object;
          const invoiceId = session.metadata?.["invoice_id"];
          if (invoiceId) {
            const { markInvoicePaid } = await import("@/lib/invoicing.server");
            await markInvoicePaid({
              invoiceId,
              amountCents: session.amount_total ?? 0,
              providerRef: session.payment_intent ?? session.id,
            });
          }
        }

        return new Response("ok");
      },
    },
  },
});
