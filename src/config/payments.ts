import { readEnv, requireEnv } from "./env";

export type PaymentEnvironment = "sandbox" | "production";

export function paymentsProvider(): string {
  return (readEnv("PAYMENTS_PROVIDER", "VITE_PAYMENTS_PROVIDER") ?? "hyperswitch").toLowerCase();
}

export function paymentEnvironment(): PaymentEnvironment {
  const raw = (readEnv("HYPERSWITCH_ENVIRONMENT", "VITE_HYPERSWITCH_ENVIRONMENT") ?? "sandbox").toLowerCase();
  return raw === "production" || raw === "live" ? "production" : "sandbox";
}

/** Hyperswitch REST base URL. */
export function hyperswitchApiUrl(): string {
  return (
    readEnv("HYPERSWITCH_API_URL", "HYPERSWITCH_BASE_URL") ??
    (paymentEnvironment() === "production"
      ? "https://api.hyperswitch.io"
      : "https://sandbox.hyperswitch.io")
  );
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

/** True when every value needed to take a payment is present. */
export function isPaymentsConfigured(): boolean {
  return Boolean(
    readEnv("HYPERSWITCH_API_KEY") && hyperswitchPublishableKey() && hyperswitchProfileId(),
  );
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
