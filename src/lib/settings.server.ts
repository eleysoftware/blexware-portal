// Admin-controlled runtime settings. Stored in public.app_settings and read
// with the admin client so public routes (the invoice pay page) can honour them
// without any anon grant. Falls back to env/defaults when the table or row is
// missing, so the app keeps working in any environment.

import { adminDb, writeAudit } from "@/lib/blex.server";
import { defaultPaymentMethods } from "@/config/payments";

export type PaymentMethodChoice = "bank" | "card";
export type PaymentMethodSettings = Record<PaymentMethodChoice, boolean>;

const KEY = "payment_methods";

function coerce(value: unknown, fallback: PaymentMethodSettings): PaymentMethodSettings {
  if (!value || typeof value !== "object") return fallback;
  const raw = value as Record<string, unknown>;
  return {
    bank: typeof raw["bank"] === "boolean" ? raw["bank"] : fallback.bank,
    card: typeof raw["card"] === "boolean" ? raw["card"] : fallback.card,
  };
}

/** Which payment methods clients may choose from right now. */
export async function getPaymentMethodSettings(): Promise<PaymentMethodSettings> {
  const fallback = defaultPaymentMethods();
  try {
    const { data, error } = await adminDb()
      .from("app_settings")
      .select("value")
      .eq("key", KEY)
      .maybeSingle();
    if (error) {
      console.error("[settings] payment_methods read failed:", error.message);
      return fallback;
    }
    return coerce(data?.["value"], fallback);
  } catch (error) {
    console.error("[settings] payment_methods unavailable:", error);
    return fallback;
  }
}

/** Turns one payment method on or off. Admin-gated by the calling server fn. */
export async function setPaymentMethodEnabled(input: {
  method: PaymentMethodChoice;
  enabled: boolean;
  actorId?: string | null;
}): Promise<PaymentMethodSettings> {
  const current = await getPaymentMethodSettings();
  const next: PaymentMethodSettings = { ...current, [input.method]: input.enabled };

  const { error } = await adminDb()
    .from("app_settings")
    .upsert(
      {
        key: KEY,
        value: next,
        updated_at: new Date().toISOString(),
        updated_by: input.actorId ?? null,
      },
      { onConflict: "key" },
    );
  if (error) {
    console.error("[settings] payment_methods write failed:", error.message);
    throw new Error("Could not save the payment method settings. Please try again.");
  }

  await writeAudit({
    actorId: input.actorId ?? null,
    actorLabel: "admin",
    action: "settings.payment_methods.updated",
    entity: "settings",
    entityId: KEY,
    metadata: { method: input.method, enabled: input.enabled },
  });

  return next;
}

export type PaymentProviderName = "hyperswitch" | "paypal";
export type PaymentEnvironment = "sandbox" | "live";

export type PaymentProviderSettings = {
  provider: PaymentProviderName;
  environment: PaymentEnvironment;
};

const PROVIDER_KEY = "payment_provider";
const ENVIRONMENT_KEY = "payment_environment";

function providerCoerce(value: unknown, fallback: PaymentProviderName): PaymentProviderName {
  if (value === "hyperswitch" || value === "paypal") return value;
  return fallback;
}

function environmentCoerce(value: unknown, fallback: PaymentEnvironment): PaymentEnvironment {
  if (value === "sandbox" || value === "live") return value;
  return fallback;
}

/** Which payment provider and environment are active right now. */
export async function getPaymentProviderSettings(
  defaults?: Partial<PaymentProviderSettings>,
): Promise<PaymentProviderSettings> {
  const fallback: PaymentProviderSettings = {
    provider: defaults?.provider ?? "hyperswitch",
    environment: defaults?.environment ?? "sandbox",
  };
  try {
    const { data, error } = await adminDb()
      .from("app_settings")
      .select("key, value")
      .in("key", [PROVIDER_KEY, ENVIRONMENT_KEY]);
    if (error) {
      console.error("[settings] payment_provider read failed:", error.message);
      return fallback;
    }
    const map = new Map((data ?? []).map((row) => [row.key, row.value]));
    return {
      provider: providerCoerce(map.get(PROVIDER_KEY), fallback.provider),
      environment: environmentCoerce(map.get(ENVIRONMENT_KEY), fallback.environment),
    };
  } catch (error) {
    console.error("[settings] payment_provider unavailable:", error);
    return fallback;
  }
}

/** Sets the active payment provider and/or environment. Admin-gated by the caller. */
export async function setPaymentProviderSettings(input: {
  provider?: PaymentProviderName;
  environment?: PaymentEnvironment;
  actorId?: string | null;
}): Promise<PaymentProviderSettings> {
  const current = await getPaymentProviderSettings();
  const next: PaymentProviderSettings = {
    provider: input.provider ?? current.provider,
    environment: input.environment ?? current.environment,
  };

  const now = new Date().toISOString();
  const { error } = await adminDb()
    .from("app_settings")
    .upsert(
      [
        { key: PROVIDER_KEY, value: next.provider, updated_at: now, updated_by: input.actorId ?? null },
        { key: ENVIRONMENT_KEY, value: next.environment, updated_at: now, updated_by: input.actorId ?? null },
      ],
      { onConflict: "key" },
    );
  if (error) {
    console.error("[settings] payment_provider write failed:", error.message);
    throw new Error("Could not save the payment provider settings. Please try again.");
  }

  await writeAudit({
    actorId: input.actorId ?? null,
    actorLabel: "admin",
    action: "settings.payment_provider.updated",
    entity: "settings",
    entityId: PROVIDER_KEY,
    metadata: { from: current, to: next },
  });

  return next;
}
