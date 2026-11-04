// PayPal Business provider implementation. Uses the PayPal Orders v2 REST API
// with OAuth2 client-credentials tokens. No Node-only SDK is used so this runs
// on the Worker runtime.
import { readEnv } from "@/config/env";
import { paypalSecretFor } from "@/config/payments";

import { UserFacingError } from "@/lib/errors";
import type {
  CreatePaymentInput,
  PaymentProvider,
  PaymentSnapshot,
  PaymentStatus,
  PublicConfig,
  RefundResult,
  SettlementView,
  WebhookParseResult,
} from "@/lib/payments/provider";

export type PayPalEnvironment = "sandbox" | "live";

export function paypalEnvironment(): PayPalEnvironment {
  const raw = (readEnv("PAYMENT_ENVIRONMENT") ?? "sandbox").toLowerCase();
  return raw === "live" || raw === "production" ? "live" : "sandbox";
}

function baseUrl(environment: PayPalEnvironment): string {
  return environment === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
}

export type PayPalCredentials = {
  clientId: string;
  clientSecret: string;
  webhookId: string;
};

function credentials(environment: PayPalEnvironment): PayPalCredentials {
  const prefix = environment === "live" ? "PAYPAL_LIVE" : "PAYPAL_SANDBOX";
  const clientId = readEnv(`${prefix}_CLIENT_ID`);
  const clientSecret = paypalSecretFor(prefix);
  const webhookId = readEnv(`${prefix}_WEBHOOK_ID`);
  if (!clientId || !clientSecret) {
    throw new Error(
      `PayPal ${environment} credentials are not configured. Set ${prefix}_CLIENT_ID and ${prefix}_CLIENT_SECRET.`,
    );
  }
  return { clientId, clientSecret: clientSecret, webhookId: webhookId ?? "" };
}


export function isPayPalConfigured(environment?: PayPalEnvironment): boolean {
  try {
    credentials(environment ?? paypalEnvironment());
    return true;
  } catch {
    return false;
  }
}

let tokenCache: {
  environment: PayPalEnvironment;
  accessToken: string;
  expiresAt: number;
} | null = null;

async function getAccessToken(environment: PayPalEnvironment): Promise<string> {
  if (tokenCache && tokenCache.environment === environment && tokenCache.expiresAt > Date.now() + 60_000) {
    return tokenCache.accessToken;
  }
  const { clientId, clientSecret } = credentials(environment);
  const response = await fetch(`${baseUrl(environment)}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    },
    body: "grant_type=client_credentials",
  });
  const text = await response.text();
  if (!response.ok) {
    console.error("[paypal] token error", response.status, text);
    throw new Error("Could not authenticate with PayPal.");
  }
  const parsed = JSON.parse(text) as { access_token: string; expires_in?: number };
  tokenCache = {
    environment,
    accessToken: parsed.access_token,
    expiresAt: Date.now() + (parsed.expires_in ?? 3600) * 1000,
  };
  return parsed.access_token;
}

async function paypalRequest<T>(
  environment: PayPalEnvironment,
  path: string,
  init: { method: "GET" | "POST" | "PATCH"; body?: unknown } = { method: "GET" },
): Promise<T> {
  const token = await getAccessToken(environment);
  const response = await fetch(`${baseUrl(environment)}${path}`, {
    method: init.method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });
  const text = await response.text();
  if (!response.ok) {
    console.error("[paypal]", init.method, path, response.status, text);
    let message = "The payment service could not complete this request. Please try again.";
    try {
      const parsed = JSON.parse(text) as { message?: string; details?: Array<{ description?: string }> };
      if (parsed.message) message = parsed.message;
      else if (parsed.details?.[0]?.description) message = parsed.details[0].description;
    } catch {
      /* ignore */
    }
    throw new UserFacingError(message);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

function mapStatus(status: string): PaymentStatus {
  switch (status.toUpperCase()) {
    case "COMPLETED":
    case "CAPTURED":
      return "succeeded";
    case "APPROVED":
    case "PAYER_ACTION_REQUIRED":
      return "action_required";
    case "VOIDED":
    case "CANCELLED":
      return "cancelled";
    case "FAILED":
    case "DECLINED":
      return "failed";
    case "REFUNDED":
      return "refunded";
    case "PARTIALLY_REFUNDED":
      return "partially_refunded";
    default:
      return "processing";
  }
}

type Order = {
  id: string;
  status: string;
  purchase_units?: Array<{
    amount?: { currency_code?: string; value?: string };
    payments?: {
      captures?: Array<{
        id?: string;
        status?: string;
        amount?: { currency_code?: string; value?: string };
      }>;
    };
  }>;
  payment_source?: Record<string, unknown>;
};

type Capture = {
  id: string;
  status: string;
  amount?: { currency_code?: string; value?: string };
};

type Refund = {
  id: string;
  status: string;
  amount?: { currency_code?: string; value?: string };
};

function parseAmount(value: string | undefined, fallback = 0): number {
  if (!value) return fallback;
  const parsed = Math.round(Number(value) * 100);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function orderToSnapshot(order: Order): PaymentSnapshot {
  const capture = order.purchase_units?.[0]?.payments?.captures?.[0];
  const amount = parseAmount(order.purchase_units?.[0]?.amount?.value);
  const captured = parseAmount(capture?.amount?.value, 0);
  return {
    providerPaymentId: order.id,
    status: mapStatus(capture?.status ?? order.status),
    amountCents: captured || amount,
    currency: (order.purchase_units?.[0]?.amount?.currency_code ?? "USD").toLowerCase(),
    clientToken: null,
    paymentMethod: order.payment_source ? Object.keys(order.payment_source)[0] ?? null : null,
    connector: "paypal",
    processorTransactionId: capture?.id ?? null,
    failureCode: null,
    failureMessage: null,
  };
}

export function createPaypalProvider(environment: PayPalEnvironment = "sandbox"): PaymentProvider {
  const env = environment;

  return {
  name: "paypal",

  isConfigured(): boolean {
    return isPayPalConfigured(env);
  },

  publicConfig(): PublicConfig {
    const { clientId } = credentials(env);
    return {
      provider: "paypal",
      checkout: {
        kind: "paypal",
        clientId,
        environment: env,
      },
    };
  },

  async createPayment(input: CreatePaymentInput): Promise<PaymentSnapshot> {
    const currency = (input.currency ?? "usd").toUpperCase();
    const amountDollars = (input.amountCents / 100).toFixed(2);
    const order = await paypalRequest<Order>(env, "/v2/checkout/orders", {
      method: "POST",
      body: {
        intent: "CAPTURE",
        purchase_units: [
          {
            invoice_id: input.reference,
            description: input.description,
            amount: {
              currency_code: currency,
              value: amountDollars,
            },
          },
        ],
        application_context: {
          return_url: input.returnUrl,
          cancel_url: input.returnUrl,
          shipping_preference: "NO_SHIPPING",
          user_action: "PAY_NOW",
          brand_name: "BLEXware",
        },
      },
    });
    const snapshot = orderToSnapshot(order);
    // The order id is what the PayPal JS SDK needs to render the buttons.
    return { ...snapshot, clientToken: order.id };
  },

  async getPayment(providerPaymentId: string): Promise<PaymentSnapshot> {
    const order = await paypalRequest<Order>(env, `/v2/checkout/orders/${providerPaymentId}`);
    return orderToSnapshot(order);
  },

  async getSettlement(providerPaymentId: string): Promise<SettlementView> {
    const snapshot = await this.getPayment(providerPaymentId);
    return {
      providerPaymentId: snapshot.providerPaymentId,
      status: snapshot.status,
      amountCents: snapshot.amountCents,
      netAmountCents: null,
      feeCents: null,
      connector: snapshot.connector,
      paymentMethod: snapshot.paymentMethod,
      settledAt: null,
    };
  },

  async cancelPayment(providerPaymentId: string): Promise<PaymentSnapshot> {
    // PayPal orders cannot be voided via the Orders API; return the current
    // status so the caller can treat the attempt as cancelled/abandoned.
    return this.getPayment(providerPaymentId);
  },

  async refundPayment(input: {
    providerPaymentId: string;
    amountCents: number;
    reason?: string | null;
  }): Promise<RefundResult> {
    // Find the capture id from the order.
    const order = await paypalRequest<Order>(env, `/v2/checkout/orders/${input.providerPaymentId}`);
    const captureId = order.purchase_units?.[0]?.payments?.captures?.[0]?.id;
    if (!captureId) throw new Error("No captured payment to refund.");

    const amountDollars = (input.amountCents / 100).toFixed(2);
    const refund = await paypalRequest<Refund>(env, `/v2/payments/captures/${captureId}/refund`, {
      method: "POST",
      body: {
        amount: { currency_code: (order.purchase_units?.[0]?.amount?.currency_code ?? "USD").toUpperCase(), value: amountDollars },
        note_to_payer: input.reason ?? undefined,
      },
    });
    return {
      refundId: refund.id,
      status: refund.status.toLowerCase(),
      amountCents: parseAmount(refund.amount?.value, input.amountCents),
    };
  },

  async parseWebhook(request: Request): Promise<WebhookParseResult> {
    const { webhookId } = credentials(env);
    if (!webhookId) {
      console.warn("[paypal] webhook id not configured; skipping verification");
      return { kind: "ignore" };
    }

    const body = await request.text();
    const transmissionId = request.headers.get("paypal-transmission-id") ?? "";
    const certUrl = request.headers.get("paypal-cert-url") ?? "";
    const authAlgo = request.headers.get("paypal-auth-algo") ?? "";
    const transmissionTime = request.headers.get("paypal-transmission-time") ?? "";
    const signature = request.headers.get("paypal-transmission-sig") ?? "";

    // PayPal webhook signature verification endpoint.
    const verify = await paypalRequest<{ verification_status: string }>(env, "/v1/notifications/verify-webhook-signature", {
      method: "POST",
      body: {
        auth_algo: authAlgo,
        cert_url: certUrl,
        transmission_id: transmissionId,
        transmission_sig: signature,
        transmission_time: transmissionTime,
        webhook_id: webhookId,
        webhook_event: JSON.parse(body),
      },
    });

    if (verify.verification_status !== "SUCCESS") {
      return { kind: "ignore" };
    }

    const event = JSON.parse(body) as {
      id?: string;
      event_type?: string;
      resource?: {
        id?: string;
        status?: string;
        amount?: { currency_code?: string; value?: string };
        parent_payment?: string;
        invoice_id?: string;
      };
    };

    const eventType = event.event_type ?? "";
    const resource = event.resource ?? {};

    if (eventType === "CHECKOUT.ORDER.APPROVED") {
      return {
        kind: "payment",
        providerPaymentId: resource.id ?? "",
        status: "action_required",
      };
    }

    if (eventType === "PAYMENT.CAPTURE.COMPLETED") {
      return {
        kind: "payment",
        providerPaymentId: resource.parent_payment ?? "",
        status: "succeeded",
        amountCents: parseAmount(resource.amount?.value),
        processorTransactionId: resource.id ?? null,
      };
    }

    if (eventType === "PAYMENT.CAPTURE.DENIED") {
      return {
        kind: "payment",
        providerPaymentId: resource.parent_payment ?? "",
        status: "failed",
        amountCents: parseAmount(resource.amount?.value),
        processorTransactionId: resource.id ?? null,
      };
    }

    if (eventType === "PAYMENT.CAPTURE.REFUNDED") {
      return {
        kind: "refund",
        refundId: resource.id ?? "",
        providerPaymentId: resource.parent_payment ?? "",
        status: "succeeded",
        amountCents: parseAmount(resource.amount?.value),
      };
    }

    // Recurring billing (PayPal Subscriptions) events.
    const sub = resource as { id?: string; status?: string; billing_agreement_id?: string; amount?: { total?: string; value?: string } };
    if (eventType === "PAYMENT.SALE.COMPLETED" && sub.billing_agreement_id) {
      return {
        kind: "subscription_payment",
        eventId: event.id ?? `sale:${sub.id ?? ""}`,
        subscriptionId: sub.billing_agreement_id,
        saleId: sub.id ?? "",
        amountCents: parseAmount(sub.amount?.total ?? sub.amount?.value),
      };
    }
    if (eventType.startsWith("BILLING.SUBSCRIPTION.") && sub.id) {
      return {
        kind: "subscription_status",
        eventId: event.id ?? `${eventType}:${sub.id}`,
        subscriptionId: sub.id,
        status: (sub.status ?? eventType.replace("BILLING.SUBSCRIPTION.", "")).toUpperCase(),
      };
    }

    return { kind: "ignore" };
  },
};
}

/** Env-default instance. Prefer createPaypalProvider(activeEnvironment). */
export const paypalProvider: PaymentProvider = createPaypalProvider(paypalEnvironment());

// ---------------------------------------------------------------------------
// PayPal Subscriptions (yearly auto-renew)

export type PayPalSubscription = {
  id: string;
  status: string;
  billing_info?: {
    next_billing_time?: string;
    last_payment?: { amount?: { value?: string }; time?: string };
  };
  links?: Array<{ rel: string; href: string }>;
};

export const paypalSubscriptions = {
  async createProduct(env: PayPalEnvironment, name: string): Promise<string> {
    const product = await paypalRequest<{ id: string }>(env, "/v1/catalogs/products", {
      method: "POST",
      body: { name, type: "SERVICE", category: "SOFTWARE" },
    });
    return product.id;
  },
  async createYearlyPlan(
    env: PayPalEnvironment,
    input: { productId: string; name: string; amountCents: number; currency: string },
  ): Promise<string> {
    const plan = await paypalRequest<{ id: string }>(env, "/v1/billing/plans", {
      method: "POST",
      body: {
        product_id: input.productId,
        name: input.name,
        status: "ACTIVE",
        billing_cycles: [
          {
            frequency: { interval_unit: "YEAR", interval_count: 1 },
            tenure_type: "REGULAR",
            sequence: 1,
            total_cycles: 0,
            pricing_scheme: {
              fixed_price: { value: (input.amountCents / 100).toFixed(2), currency_code: input.currency },
            },
          },
        ],
        payment_preferences: { auto_bill_outstanding: true, payment_failure_threshold: 2 },
      },
    });
    return plan.id;
  },
  async create(
    env: PayPalEnvironment,
    input: { planId: string; customId: string; email?: string | null; returnUrl: string; cancelUrl: string },
  ): Promise<{ id: string; approveUrl: string }> {
    const result = await paypalRequest<PayPalSubscription>(env, "/v1/billing/subscriptions", {
      method: "POST",
      body: {
        plan_id: input.planId,
        custom_id: input.customId,
        ...(input.email ? { subscriber: { email_address: input.email } } : {}),
        application_context: {
          brand_name: "BLEXware",
          user_action: "SUBSCRIBE_NOW",
          shipping_preference: "NO_SHIPPING",
          return_url: input.returnUrl,
          cancel_url: input.cancelUrl,
        },
      },
    });
    const approveUrl = result.links?.find((link) => link.rel === "approve")?.href;
    if (!approveUrl) throw new UserFacingError("PayPal did not return an approval link.");
    return { id: result.id, approveUrl };
  },
  get(env: PayPalEnvironment, id: string): Promise<PayPalSubscription> {
    return paypalRequest<PayPalSubscription>(env, `/v1/billing/subscriptions/${encodeURIComponent(id)}`);
  },
  async cancel(env: PayPalEnvironment, id: string, reason: string): Promise<void> {
    await paypalRequest(env, `/v1/billing/subscriptions/${encodeURIComponent(id)}/cancel`, {
      method: "POST",
      body: { reason },
    });
  },
};
