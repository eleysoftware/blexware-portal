// BLEXware's processor-agnostic payment service. The invoice system talks to
// this module only. It delegates to the active PaymentProvider (Hyperswitch,
// PayPal, etc.) selected in app_settings.
import { readEnv } from "@/config/env";
import { adminDb } from "@/lib/blex.server";
import { hyperswitchProvider } from "@/lib/payments/hyperswitch.provider.server";
import { paypalProvider } from "@/lib/payments/paypal.provider.server";
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

/** Reads the active provider from app_settings, falling back to env or hyperswitch. */
export async function getActiveProviderName(): Promise<SupportedProvider> {
  const env = readEnv("PAYMENT_PROVIDER")?.toLowerCase();
  if (env === "paypal" || env === "hyperswitch") return env;
  try {
    const { data } = await adminDb()
      .from("app_settings")
      .select("value")
      .eq("key", "payment_provider")
      .maybeSingle();
    const value = String((data?.value as string | null) ?? "").replace(/^"|"$/g, "");
    if (value === "paypal" || value === "hyperswitch") return value;
  } catch {
    /* fall back to default */
  }
  return "hyperswitch";
}

/** Reads the active environment from app_settings, falling back to env or sandbox. */
export async function getActiveEnvironment(): Promise<PaymentEnvironment> {
  const env = readEnv("PAYMENT_ENVIRONMENT")?.toLowerCase();
  if (env === "live" || env === "production") return "live";
  try {
    const { data } = await adminDb()
      .from("app_settings")
      .select("value")
      .eq("key", "payment_environment")
      .maybeSingle();
    const value = String((data?.value as string | null) ?? "").replace(/^"|"$/g, "");
    if (value === "live") return "live";
  } catch {
    /* fall back to default */
  }
  return "sandbox";
}

function providerByName(name: SupportedProvider): PaymentProvider {
  switch (name) {
    case "paypal":
      return paypalProvider;
    case "hyperswitch":
    default:
      return hyperswitchProvider;
  }
}

/** Resolves the currently configured payment provider. */
export async function activeProvider(): Promise<PaymentProvider> {
  const name = await getActiveProviderName();
  return providerByName(name);
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
