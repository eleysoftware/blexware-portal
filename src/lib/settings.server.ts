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
