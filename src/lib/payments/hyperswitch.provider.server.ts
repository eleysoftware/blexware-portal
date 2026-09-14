// Hyperswitch provider implementation of the processor-agnostic interface.
// This is the existing BLEXware payment path, moved behind the PaymentProvider
// interface so it can coexist with PayPal.
import { UserFacingError } from "@/lib/errors";
import {
  HyperswitchApiError,
  hyperswitchConfig,
  hyperswitchRequest,
  isPaymentsConfigured,
  verifyWebhookSignature,
} from "@/lib/payments/hyperswitch.server";
import type {
  CreatePaymentInput,
  PaymentMethodChoice,
  PaymentProvider,
  PaymentSnapshot,
  PaymentStatus,
  PublicConfig,
  RefundResult,
  SettlementView,
  WebhookParseResult,
} from "@/lib/payments/provider";

export const METHOD_TYPES: Record<PaymentMethodChoice, string[]> = {
  bank: ["ach"],
  card: ["credit", "debit"],
};

export const METHOD_UNAVAILABLE_MESSAGE: Record<PaymentMethodChoice, string> = {
  bank: "Bank (ACH) payments aren't available on this invoice yet. Please pay by credit or debit card.",
  card: "Card payments aren't available on this invoice yet. Please pay by bank (ACH).",
};

/** True when Hyperswitch reports no connector eligible for the requested method. */
export function isMethodUnavailable(error: unknown): boolean {
  if (!(error instanceof HyperswitchApiError)) return false;
  if (error.code === "IR_39") return true;
  return Boolean(error.providerMessage?.toLowerCase().includes("no eligible connector"));
}

type HyperswitchPayment = {
  payment_id: string;
  status: string;
  amount: number;
  amount_received?: number | null;
  net_amount?: number | null;
  currency: string;
  client_secret?: string | null;
  connector?: string | null;
  payment_method?: string | null;
  payment_method_type?: string | null;
  connector_transaction_id?: string | null;
  error_code?: string | null;
  error_message?: string | null;
  created?: string | null;
  updated?: string | null;
};

export function mapPaymentStatus(status: string): PaymentStatus {
  switch (status) {
    case "succeeded":
    case "partially_captured":
    case "partially_captured_and_capturable":
      return "succeeded";
    case "processing":
    case "requires_capture":
      return "processing";
    case "requires_payment_method":
    case "requires_confirmation":
    case "requires_customer_action":
    case "requires_merchant_action":
      return "action_required";
    case "failed":
      return "failed";
    case "cancelled":
      return "cancelled";
    default:
      return "processing";
  }
}

function toSnapshot(payment: HyperswitchPayment): PaymentSnapshot {
  return {
    providerPaymentId: payment.payment_id,
    status: mapPaymentStatus(payment.status),
    amountCents: Number(payment.amount_received ?? payment.amount ?? 0) || Number(payment.amount ?? 0),
    currency: (payment.currency ?? "USD").toLowerCase(),
    clientToken: payment.client_secret ?? null,
    paymentMethod: payment.payment_method_type ?? payment.payment_method ?? null,
    connector: payment.connector ?? null,
    processorTransactionId: payment.connector_transaction_id ?? null,
    failureCode: payment.error_code ?? null,
    failureMessage: payment.error_message ?? null,
  };
}

export function createHyperswitchProvider(environment: "sandbox" | "live" = "sandbox"): PaymentProvider {
  const hsEnv: "sandbox" | "production" = environment === "live" ? "production" : "sandbox";
  const config = () => hyperswitchConfig(hsEnv);
  const request = <T,>(path: string, init: { method: "GET" | "POST"; body?: unknown } = { method: "GET" }) =>
    hyperswitchRequest<T>(path, init, hsEnv);

  return {
  name: "hyperswitch",

  isConfigured(): boolean {
    return isPaymentsConfigured();
  },

  publicConfig(): PublicConfig {
    const config = config();
    return {
      provider: "hyperswitch",
      checkout: {
        kind: "hyperswitch",
        publishableKey: config.publishableKey,
        profileId: config.profileId,
        environment: config.environment,
      },
    };
  },

  async createPayment(input: CreatePaymentInput): Promise<PaymentSnapshot> {
    const config = config();
    const payment = await request<HyperswitchPayment>("/payments", {
      method: "POST",
      body: {
        amount: input.amountCents,
        currency: (input.currency ?? "usd").toUpperCase(),
        profile_id: config.profileId,
        confirm: false,
        capture_method: "automatic",
        description: input.description,
        return_url: input.returnUrl,
        ...(input.methods ? { allowed_payment_method_types: METHOD_TYPES[input.methods] } : {}),
        ...(input.customerEmail ? { email: input.customerEmail } : {}),
        ...(input.customerName ? { name: input.customerName } : {}),
        metadata: {
          reference: input.reference,
          ...(input.methods ? { method_choice: input.methods } : {}),
          ...(input.metadata ?? {}),
        },
      },
    }).catch((error: unknown) => {
      if (input.methods && isMethodUnavailable(error)) {
        throw new UserFacingError(METHOD_UNAVAILABLE_MESSAGE[input.methods]);
      }
      throw error;
    });
    return toSnapshot(payment);
  },

  async getPayment(providerPaymentId: string): Promise<PaymentSnapshot> {
    const payment = await request<HyperswitchPayment>(
      `/payments/${providerPaymentId}?force_sync=true`,
      { method: "GET" },
    );
    return toSnapshot(payment);
  },

  async getSettlement(providerPaymentId: string): Promise<SettlementView> {
    const payment = await request<HyperswitchPayment>(
      `/payments/${providerPaymentId}?force_sync=true`,
      { method: "GET" },
    );
    const amountCents = Number(payment.amount_received ?? payment.amount ?? 0);
    const netAmountCents =
      payment.net_amount === null || payment.net_amount === undefined ? null : Number(payment.net_amount);
    return {
      providerPaymentId: payment.payment_id,
      status: mapPaymentStatus(payment.status),
      amountCents,
      netAmountCents,
      feeCents:
        netAmountCents !== null && amountCents > 0 && netAmountCents <= amountCents
          ? amountCents - netAmountCents
          : null,
      connector: payment.connector ?? null,
      paymentMethod: payment.payment_method_type ?? payment.payment_method ?? null,
      settledAt: payment.updated ?? null,
    };
  },

  async cancelPayment(providerPaymentId: string, reason = "Cancelled by BLEXware"): Promise<PaymentSnapshot> {
    const payment = await request<HyperswitchPayment>(
      `/payments/${providerPaymentId}/cancel`,
      { method: "POST", body: { cancellation_reason: reason } },
    );
    return toSnapshot(payment);
  },

  async refundPayment(input: {
    providerPaymentId: string;
    amountCents: number;
    reason?: string | null;
  }): Promise<RefundResult> {
    const refund = await request<{ refund_id: string; status: string; amount: number }>("/refunds", {
      method: "POST",
      body: {
        payment_id: input.providerPaymentId,
        amount: input.amountCents,
        ...(input.reason ? { reason: input.reason } : {}),
      },
    });
    return {
      refundId: refund.refund_id,
      status: refund.status,
      amountCents: Number(refund.amount ?? input.amountCents),
    };
  },

  async parseWebhook(request: Request): Promise<WebhookParseResult> {
    const secret = config().webhookSecret ?? "";
    if (!secret) return { kind: "ignore" };

    const body = await request.text();
    const sig512 = request.headers.get("x-webhook-signature-512") ?? "";
    const sig256 = request.headers.get("x-webhook-signature-256") ?? "";
    const verified = sig512
      ? await verifyWebhookSignature(body, sig512, secret, "SHA-512")
      : sig256
        ? await verifyWebhookSignature(body, sig256, secret, "SHA-256")
        : false;
    if (!verified) return { kind: "ignore" };

    let event: {
      event_id?: string;
      event_type?: string;
      type?: string;
      content?: { type?: string; object?: Record<string, unknown> };
    };
    try {
      event = JSON.parse(body) as typeof event;
    } catch {
      return { kind: "ignore" };
    }

    const eventType = event.event_type ?? event.type ?? "";
    const object = event.content?.object ?? {};

    const paymentEvents = new Set([
      "payment_succeeded",
      "payment_failed",
      "payment_processing",
      "payment_cancelled",
      "payment_authorized",
      "payment_captured",
      "action_required",
    ]);
    const refundEvents = new Set(["refund_succeeded", "refund_failed"]);

    if (paymentEvents.has(eventType) || eventType === "dispute_opened") {
      return {
        kind: "payment",
        providerPaymentId: String(object["payment_id"] ?? ""),
        status:
          eventType === "dispute_opened"
            ? "disputed"
            : mapPaymentStatus(String(object["status"] ?? "processing")),
        amountCents: Number(object["amount_received"] ?? object["amount"] ?? 0) || undefined,
        paymentMethod:
          (object["payment_method_type"] as string | null) ??
          (object["payment_method"] as string | null) ??
          null,
        processorTransactionId: (object["connector_transaction_id"] as string | null) ?? null,
        failureMessage: (object["error_message"] as string | null) ?? null,
      };
    }

    if (refundEvents.has(eventType)) {
      return {
        kind: "refund",
        refundId: String(object["refund_id"] ?? ""),
        providerPaymentId: String(object["payment_id"] ?? ""),
        status: eventType === "refund_succeeded" ? "succeeded" : "failed",
        amountCents: Number(object["amount"] ?? 0),
        processorRefundId: (object["connector_refund_id"] as string | null) ?? null,
      };
    }

    return { kind: "ignore" };
  },
};
}

export const hyperswitchProvider: PaymentProvider = createHyperswitchProvider();
