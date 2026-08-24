// BLEXware's processor-agnostic payment service. The invoice system talks to
// this module only — never to Helcim, Stripe or any other processor directly.
// Hyperswitch is the orchestration layer; the connector is chosen in the
// Hyperswitch dashboard, not in this codebase.
import {
  HyperswitchApiError,
  hyperswitchConfig,
  hyperswitchRequest,
  isPaymentsConfigured,
} from "@/lib/payments/hyperswitch.server";
import { UserFacingError } from "@/lib/errors";

export type PaymentStatus =
  | "created"
  | "processing"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "refunded"
  | "partially_refunded"
  | "disputed"
  | "action_required";

export type PaymentSnapshot = {
  providerPaymentId: string;
  status: PaymentStatus;
  amountCents: number;
  currency: string;
  clientSecret: string | null;
  paymentMethod: string | null;
  connector: string | null;
  processorTransactionId: string | null;
  failureCode: string | null;
  failureMessage: string | null;
};

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

/** The two payment families a client can choose from on an invoice. */
export type PaymentMethodChoice = "bank" | "card";

/** Hyperswitch payment method types per family. Connectors stay dashboard-configured. */
export const METHOD_TYPES: Record<PaymentMethodChoice, string[]> = {
  bank: ["ach"],
  card: ["credit", "debit"],
};


/** Maps Hyperswitch payment statuses onto BLEXware payment states. */
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
    clientSecret: payment.client_secret ?? null,
    paymentMethod: payment.payment_method_type ?? payment.payment_method ?? null,
    connector: payment.connector ?? null,
    processorTransactionId: payment.connector_transaction_id ?? null,
    failureCode: payment.error_code ?? null,
    failureMessage: payment.error_message ?? null,
  };
}

export const PaymentService = {
  isConfigured: isPaymentsConfigured,

  publicConfig() {
    const config = hyperswitchConfig();
    return {
      publishableKey: config.publishableKey,
      profileId: config.profileId,
      environment: config.environment,
    };
  },

  /**
   * Creates a payment for a server-calculated amount. When `methods` is given,
   * only that family (bank/ACH or card) is offered in the hosted checkout.
   */
  async createPayment(input: {
    amountCents: number;
    currency?: string;
    reference: string;
    description: string;
    customerEmail?: string | null;
    customerName?: string | null;
    returnUrl: string;
    methods?: PaymentMethodChoice;
    metadata?: Record<string, string>;
  }): Promise<PaymentSnapshot> {
    const config = hyperswitchConfig();
    const payment = await hyperswitchRequest<HyperswitchPayment>("/payments", {
      method: "POST",
      body: {
        amount: input.amountCents,
        currency: (input.currency ?? "usd").toUpperCase(),
        profile_id: config.profileId,
        confirm: false,
        capture_method: "automatic",
        description: input.description,
        return_url: input.returnUrl,
        ...(input.methods
          ? { allowed_payment_method_types: METHOD_TYPES[input.methods] }
          : {}),
        ...(input.customerEmail ? { email: input.customerEmail } : {}),
        ...(input.customerName ? { name: input.customerName } : {}),
        metadata: {
          reference: input.reference,
          ...(input.methods ? { method_choice: input.methods } : {}),
          ...(input.metadata ?? {}),
        },
      },
    }).catch((error: unknown) => {
      // The chosen family has no enabled connector on the gateway account yet.
      // Tell the client which alternative works instead of a generic failure.
      if (input.methods && isMethodUnavailable(error)) {
        throw new UserFacingError(METHOD_UNAVAILABLE_MESSAGE[input.methods]);
      }
      throw error;
    });
    return toSnapshot(payment);

  },

  /**
   * Read-only settlement view for admins: what the gateway reports as the net
   * amount BLEXware receives. No payout credentials are ever exposed.
   */
  async getSettlement(providerPaymentId: string): Promise<{
    providerPaymentId: string;
    status: PaymentStatus;
    amountCents: number;
    netAmountCents: number | null;
    feeCents: number | null;
    connector: string | null;
    paymentMethod: string | null;
    settledAt: string | null;
  }> {
    const payment = await hyperswitchRequest<HyperswitchPayment>(
      `/payments/${providerPaymentId}?force_sync=true`,
      { method: "GET" },
    );
    const amountCents = Number(payment.amount_received ?? payment.amount ?? 0);
    const netAmountCents =
      payment.net_amount === null || payment.net_amount === undefined
        ? null
        : Number(payment.net_amount);
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


  async getPayment(providerPaymentId: string): Promise<PaymentSnapshot> {
    const payment = await hyperswitchRequest<HyperswitchPayment>(
      `/payments/${providerPaymentId}?force_sync=true`,
      { method: "GET" },
    );
    return toSnapshot(payment);
  },

  async getPaymentStatus(providerPaymentId: string): Promise<PaymentStatus> {
    return (await PaymentService.getPayment(providerPaymentId)).status;
  },

  async cancelPayment(providerPaymentId: string, reason = "Cancelled by BLEXware"): Promise<PaymentSnapshot> {
    const payment = await hyperswitchRequest<HyperswitchPayment>(
      `/payments/${providerPaymentId}/cancel`,
      { method: "POST", body: { cancellation_reason: reason } },
    );
    return toSnapshot(payment);
  },

  async refundPayment(input: {
    providerPaymentId: string;
    amountCents: number;
    reason?: string | null;
  }): Promise<{ refundId: string; status: string; amountCents: number }> {
    const refund = await hyperswitchRequest<{
      refund_id: string;
      status: string;
      amount: number;
    }>("/refunds", {
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
};
