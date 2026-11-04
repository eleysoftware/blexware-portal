// Pure subscription helpers (no server imports) so they can be unit-tested.

export type SubscriptionSettings = {
  enabled: boolean;
  autoRenewEnabled: boolean;
  amountCents: number;
  noticeDays: number;
  serviceName: string;
};

export const DEFAULT_SUBSCRIPTION_SETTINGS: SubscriptionSettings = {
  enabled: true,
  autoRenewEnabled: true,
  amountCents: 12_000,
  noticeDays: 14,
  serviceName: "Web Hosting",
};

export function coerceSubscriptionSettings(value: unknown): SubscriptionSettings {
  const d = DEFAULT_SUBSCRIPTION_SETTINGS;
  if (!value || typeof value !== "object") return d;
  const raw = value as Record<string, unknown>;
  const int = (v: unknown, fallback: number, min: number, max: number) =>
    typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : fallback;
  return {
    enabled: typeof raw["enabled"] === "boolean" ? raw["enabled"] : d.enabled,
    autoRenewEnabled: typeof raw["autoRenewEnabled"] === "boolean" ? raw["autoRenewEnabled"] : d.autoRenewEnabled,
    amountCents: int(raw["amountCents"], d.amountCents, 100, 10_000_000),
    noticeDays: int(raw["noticeDays"], d.noticeDays, 1, 60),
    serviceName:
      typeof raw["serviceName"] === "string" && raw["serviceName"].trim()
        ? raw["serviceName"].trim().slice(0, 80)
        : d.serviceName,
  };
}

/** Adds whole years to a YYYY-MM-DD date (Feb 29 rolls to Feb 28). */
export function addYears(date: string, years: number): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const target = new Date(Date.UTC(y + years, m - 1, d));
  if (target.getUTCMonth() !== m - 1) target.setUTCDate(0);
  return target.toISOString().slice(0, 10);
}

/** Date the advance renewal notice goes out. */
export function noticeDateFor(renewalDate: string, noticeDays: number): string {
  const date = new Date(`${renewalDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - noticeDays);
  return date.toISOString().slice(0, 10);
}

