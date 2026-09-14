import { readEnv, requireEnv } from "./env";

/**
 * Fallback payment methods when the admin setting hasn't been stored yet.
 * `PAYMENT_METHODS` is a comma list, e.g. "card" or "card,bank".
 */
export function defaultPaymentMethods(): { bank: boolean; card: boolean } {
  const raw = readEnv("PAYMENT_METHODS", "VITE_PAYMENT_METHODS");
  if (!raw) return { bank: false, card: true };
  const list = raw
    .toLowerCase()
    .split(",")
    .map((entry) => entry.trim());
  return { bank: list.includes("bank") || list.includes("ach"), card: list.includes("card") };
}

export type PaymentEnvironment = "sandbox" | "production";

export function paymentsProvider(): string {
  return (readEnv("PAYMENT_PROVIDER", "PAYMENTS_PROVIDER", "VITE_PAYMENTS_PROVIDER") ?? "hyperswitch").toLowerCase();
}

export function paymentEnvironment(): PaymentEnvironment {
  const raw = (readEnv("PAYMENT_ENVIRONMENT", "HYPERSWITCH_ENVIRONMENT", "VITE_HYPERSWITCH_ENVIRONMENT") ?? "sandbox").toLowerCase();
  return raw === "production" || raw === "live" ? "production" : "sandbox";
}

/** Hyperswitch REST base URL for a given mode. */
export function hyperswitchApiUrlFor(environment: PaymentEnvironment): string {
  return (
    readEnv("HYPERSWITCH_API_URL", "HYPERSWITCH_BASE_URL") ??
    (environment === "production" ? "https://api.hyperswitch.io" : "https://sandbox.hyperswitch.io")
  );
}

/** Hyperswitch REST base URL. */
export function hyperswitchApiUrl(): string {
  return hyperswitchApiUrlFor(paymentEnvironment());
}


/** Publishable key — browser-safe (mounted by the checkout widget). */
export function hyperswitchPublishableKey(): string | undefined {
  return readEnv("VITE_HYPERSWITCH_PUBLISHABLE_KEY", "HYPERSWITCH_PUBLISHABLE_KEY");
}

export function hyperswitchProfileId(): string | undefined {
  return readEnv("HYPERSWITCH_PROFILE_ID");
}

/** SERVER ONLY. */
export function hyperswitchApiKey(): string {
  return requireEnv(["HYPERSWITCH_API_KEY"]);
}

/** SERVER ONLY. Optional: webhooks are rejected when unset. */
export function hyperswitchWebhookSecret(): string | undefined {
  return readEnv("HYPERSWITCH_WEBHOOK_SECRET");
}

function paypalEnvPrefix(env: PaymentEnvironment): string {
  return env === "production" ? "PAYPAL_LIVE" : "PAYPAL_SANDBOX";
}

/** True when the active provider has the credentials it needs. */
export function isPaymentsConfigured(): boolean {
  const provider = paymentsProvider();
  if (provider === "paypal") {
    const prefix = paypalEnvPrefix(paymentEnvironment());
    return Boolean(readEnv(`${prefix}_CLIENT_ID`) && readEnv(`${prefix}_SECRET`));
  }
  return Boolean(
    readEnv("HYPERSWITCH_API_KEY") && hyperswitchPublishableKey() && hyperswitchProfileId(),
  );
}

/** PayPal client id for the active environment (browser-safe). */
export function paypalClientId(): string | undefined {
  return readEnv(`${paypalEnvPrefix(paymentEnvironment())}_CLIENT_ID`);
}

/** SERVER ONLY. */
export function paypalClientSecret(): string | undefined {
  return readEnv(`${paypalEnvPrefix(paymentEnvironment())}_SECRET`);
}

/** SERVER ONLY. Optional: webhook verification is skipped when unset. */
export function paypalWebhookId(): string | undefined {
  return readEnv(`${paypalEnvPrefix(paymentEnvironment())}_WEBHOOK_ID`);
}

export const payments = {
  get provider(): string {
    return paymentsProvider();
  },
  get environment(): PaymentEnvironment {
    return paymentEnvironment();
  },
  get apiUrl(): string {
    return hyperswitchApiUrl();
  },
  get publishableKey(): string | undefined {
    return hyperswitchPublishableKey();
  },
  get profileId(): string | undefined {
    return hyperswitchProfileId();
  },
  get isConfigured(): boolean {
    return isPaymentsConfigured();
  },
};
