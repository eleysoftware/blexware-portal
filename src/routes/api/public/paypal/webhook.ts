import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/paypal/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { adminDb } = await import("@/lib/blex.server");
        const { paypalProvider } = await import("@/lib/payments/paypal.provider.server");

        const parsed = await paypalProvider.parseWebhook(request);
        if (parsed.kind === "ignore") {
          return new Response("ok");
        }

        const db = adminDb();

        // Build a stable event id for idempotency. PayPal already provides an
        // event id, but we also hash the payload so replays are no-ops.
        const eventId =
          parsed.kind === "payment"
            ? `paypal:payment:${parsed.providerPaymentId}:${parsed.status}`
            : `paypal:refund:${parsed.refundId}:${parsed.status}`;

        const { error: dedupeError } = await db.from("payment_events").insert({
          event_type: parsed.kind === "payment" ? "paypal_payment" : "paypal_refund",
          event_id: eventId,
          event_payload: parsed as unknown as Record<string, unknown>,
          signature_verified: true,
        });
        if (dedupeError) {
          if (dedupeError.code === "23505" || dedupeError.message.includes("duplicate")) {
            return new Response("ok");
          }
          console.error("[paypal:webhook]", dedupeError.message);
          return new Response("error", { status: 500 });
        }

        const { applyPaymentStatus, applyRefundStatus } = await import("@/lib/invoicing.server");

        if (parsed.kind === "payment") {
          const result = await applyPaymentStatus({
            providerPaymentId: parsed.providerPaymentId,
            status: parsed.status,
            amountCents: parsed.amountCents,
            processorTransactionId: parsed.processorTransactionId ?? null,
          });

          await db
            .from("payment_events")
            .update({ processed_at: new Date().toISOString(), ...(result.applied ? { invoice_payment_id: result.invoicePaymentId } : {}) })
            .eq("event_id", eventId);
        } else {
          await applyRefundStatus({
            refundId: parsed.refundId,
            status: parsed.status,
            amountCents: parsed.amountCents,
            processorRefundId: parsed.processorRefundId ?? null,
          });

          await db.from("payment_events").update({ processed_at: new Date().toISOString() }).eq("event_id", eventId);
        }

        return new Response("ok");
      },
    },
  },
});
