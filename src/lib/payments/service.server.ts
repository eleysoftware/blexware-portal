// BLEXware's processor-agnostic payment service. The invoice system talks to
// this module only. It delegates to the active PaymentProvider (Hyperswitch,
// PayPal, etc.) selected by the admin in app_settings.
//
// Single source of truth: the admin setting in the database decides the
// provider and the mode. Environment variables are only a starting default for
// a brand-new install; they never override the saved setting.
import { readEnv } from "@/config/env";
import { isProviderConfigured } from "@/config/payments";
import { createHyperswitchProvider } from "@/lib/payments/hyperswitch.provider.server";
import { createPaypalProvider } from "@/lib/payments/paypal.provider.server";
import type {
  CreatePaymentInput,
  PaymentMethodChoice,
  PaymentProvider,
  PaymentSnapshot,
  PaymentStatus,
  RefundResult,
  SettlementView,
} from "@/lib/payments/provider";

export type { PaymentSnapshot, PaymentStatus, PaymentMethodChoice, SettlementView };

export const METHOD_UNAVAILABLE_MESSAGE: Record<PaymentMethodChoice, string> = {
  bank: "Bank (ACH) payments aren't available on this invoice yet. Please pay by credit or debit card.",
  card: "Card payments aren't available on this invoice yet. Please pay by bank (ACH).",
};

export const SUPPORTED_PROVIDERS = ["hyperswitch", "paypal"] as const;
export type SupportedProvider = (typeof SUPPORTED_PROVIDERS)[number];

export type PaymentEnvironment = "sandbox" | "live";

/** Env default used only when no admin setting has been saved yet. */
export function envDefaultProvider(): SupportedProvider {
  const raw = readEnv("PAYMENT_PROVIDER", "PAYMENTS_PROVIDER")?.toLowerCase();
  return raw === "paypal" ? "paypal" : "hyperswitch";
}

/** Env default used only when no admin setting has been saved yet. */
export function envDefaultEnvironment(): PaymentEnvironment {
  const raw = readEnv("PAYMENT_ENVIRONMENT")?.toLowerCase();
  return raw === "live" || raw === "production" ? "live" : "sandbox";
}

async function savedSettings(): Promise<{ provider: SupportedProvider; environment: PaymentEnvironment }> {
  const { getPaymentProviderSettings } = await import("@/lib/settings.server");
  return getPaymentProviderSettings({
    provider: envDefaultProvider(),
    environment: envDefaultEnvironment(),
  });
}

/** The provider the admin has selected. */
export async function getActiveProviderName(): Promise<SupportedProvider> {
  return (await savedSettings()).provider;
}

/** The mode (sandbox or live) the admin has selected. */
export async function getActiveEnvironment(): Promise<PaymentEnvironment> {
  return (await savedSettings()).environment;
}

export function providerFor(name: SupportedProvider, environment: PaymentEnvironment): PaymentProvider {
  return name === "paypal" ? createPaypalProvider(environment) : createHyperswitchProvider(environment);
}

/** True when the given provider has credentials for the given mode. */
export function providerHasCredentials(
  name: SupportedProvider,
  environment: PaymentEnvironment,
): boolean {
  return isProviderConfigured(name, environment === "live" ? "production" : "sandbox");
}

/** Resolves the currently configured payment provider. */
export async function activeProvider(): Promise<PaymentProvider> {
  const { provider, environment } = await savedSettings();
  return providerFor(provider, environment);
}


export const PaymentService = {
  async isConfigured(): Promise<boolean> {
    return (await activeProvider()).isConfigured();
  },

  async publicConfig(): Promise<ReturnType<PaymentProvider["publicConfig"]>> {
    return (await activeProvider()).publicConfig();
  },

  async createPayment(input: CreatePaymentInput): Promise<PaymentSnapshot> {
    return (await activeProvider()).createPayment(input);
  },

  async getPayment(providerPaymentId: string): Promise<PaymentSnapshot> {
    return (await activeProvider()).getPayment(providerPaymentId);
  },

  async getSettlement(providerPaymentId: string): Promise<SettlementView> {
    return (await activeProvider()).getSettlement(providerPaymentId);
  },

  async cancelPayment(providerPaymentId: string, reason?: string): Promise<PaymentSnapshot> {
    return (await activeProvider()).cancelPayment(providerPaymentId, reason);
  },

  async refundPayment(input: {
    providerPaymentId: string;
    amountCents: number;
    reason?: string | null;
  }): Promise<RefundResult> {
    return (await activeProvider()).refundPayment(input);
  },
};

/** Convenience for legacy call sites that expect synchronous config. */
export function currentProviderName(): SupportedProvider {
  const env = readEnv("PAYMENT_PROVIDER")?.toLowerCase();
  if (env === "paypal" || env === "hyperswitch") return env;
  return "hyperswitch";
}
