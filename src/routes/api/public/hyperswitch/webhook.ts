import { createFileRoute } from "@tanstack/react-router";

type WebhookBody = {
  event_id?: string;
  event_type?: string;
  type?: string;
  content?: {
    type?: string;
    object?: Record<string, unknown>;
  };
};

const PAYMENT_EVENTS = new Set([
  "payment_succeeded",
  "payment_failed",
  "payment_processing",
  "payment_cancelled",
  "payment_authorized",
  "payment_captured",
  "action_required",
]);

const REFUND_EVENTS = new Set(["refund_succeeded", "refund_failed"]);

export const Route = createFileRoute("/api/public/hyperswitch/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["HYPERSWITCH_WEBHOOK_SECRET"];
        if (!secret) return new Response("Not configured", { status: 500 });

        const body = await request.text();
        const { verifyWebhookSignature } = await import("@/lib/payments/hyperswitch.server");

        const sig512 = request.headers.get("x-webhook-signature-512") ?? "";
        const sig256 = request.headers.get("x-webhook-signature-256") ?? "";
        const verified = sig512
          ? await verifyWebhookSignature(body, sig512, secret, "SHA-512")
          : sig256
            ? await verifyWebhookSignature(body, sig256, secret, "SHA-256")
            : false;
        if (!verified) return new Response("Invalid signature", { status: 401 });

        let event: WebhookBody;
        try {
          event = JSON.parse(body) as WebhookBody;
        } catch {
          return new Response("Invalid payload", { status: 400 });
        }

        const eventType = event.event_type ?? event.type ?? "";
        const object = event.content?.object ?? {};
        const eventId =
          event.event_id ??
          `${eventType}:${String(object["payment_id"] ?? object["refund_id"] ?? "")}:${String(object["status"] ?? "")}`;
        if (!eventType || !eventId) return new Response("Invalid payload", { status: 400 });

        const { adminDb } = await import("@/lib/blex.server");
        const db = adminDb();

        // Idempotency: the unique event_id makes replays a no-op.
        const { error: dedupeError } = await db.from("payment_events").insert({
          event_type: eventType,
          event_id: eventId,
          event_payload: event as unknown as Record<string, unknown>,
          signature_verified: true,
        });
        if (dedupeError) {
          if (dedupeError.code === "23505" || dedupeError.message.includes("duplicate")) {
            return new Response("ok");
          }
          console.error("[hyperswitch:webhook]", dedupeError.message);
          return new Response("error", { status: 500 });
        }

        const {
          applyPaymentStatus,
          applyRefundStatus,
        } = await import("@/lib/invoicing.server");

        if (PAYMENT_EVENTS.has(eventType) || eventType === "dispute_opened") {
          const paymentId = String(object["payment_id"] ?? "");
          if (paymentId) {
            const { mapPaymentStatus } = await import("@/lib/payments/service.server");
            const status =
              eventType === "dispute_opened"
                ? ("disputed" as const)
                : mapPaymentStatus(String(object["status"] ?? "processing"));

            const result = await applyPaymentStatus({
              providerPaymentId: paymentId,
              status,
              amountCents: Number(object["amount_received"] ?? object["amount"] ?? 0) || undefined,
              paymentMethod:
                (object["payment_method_type"] as string | null) ??
                (object["payment_method"] as string | null) ??
                null,
              connector: (object["connector"] as string | null) ?? null,
              processorTransactionId: (object["connector_transaction_id"] as string | null) ?? null,
              failureCode: (object["error_code"] as string | null) ?? null,
              failureMessage: (object["error_message"] as string | null) ?? null,
            });

            await db
              .from("payment_events")
              .update({
                processed_at: new Date().toISOString(),
                ...(result.applied ? { invoice_payment_id: result.invoicePaymentId } : {}),
              })
              .eq("event_id", eventId);
          }
        } else if (REFUND_EVENTS.has(eventType)) {
          const refundId = String(object["refund_id"] ?? "");
          if (refundId) {
            await applyRefundStatus({
              refundId,
              status: eventType === "refund_succeeded" ? "succeeded" : "failed",
              amountCents: Number(object["amount"] ?? 0),
              processorRefundId: (object["connector_refund_id"] as string | null) ?? null,
            });
            await db
              .from("payment_events")
              .update({ processed_at: new Date().toISOString() })
              .eq("event_id", eventId);
          }
        }

        return new Response("ok");
      },
    },
  },
});
