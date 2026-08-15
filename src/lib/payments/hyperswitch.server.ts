// Thin REST client for Hyperswitch Cloud. Server-only: the API key never
// leaves this module. No processor (Helcim, Stripe, …) is referenced here —
// connectors are configured inside the Hyperswitch dashboard.

export type HyperswitchConfig = {
  apiKey: string;
  publishableKey: string;
  profileId: string;
  webhookSecret: string | null;
  environment: "sandbox" | "production";
  baseUrl: string;
};

export class PaymentsNotConfiguredError extends Error {
  constructor(missing: string[]) {
    super(
      `Online payments are not configured yet. Missing server secrets: ${missing.join(", ")}.`,
    );
    this.name = "PaymentsNotConfiguredError";
  }
}

export function isPaymentsConfigured(): boolean {
  return Boolean(
    process.env["HYPERSWITCH_API_KEY"] &&
      process.env["HYPERSWITCH_PUBLISHABLE_KEY"] &&
      process.env["HYPERSWITCH_PROFILE_ID"],
  );
}

export function hyperswitchConfig(): HyperswitchConfig {
  const apiKey = process.env["HYPERSWITCH_API_KEY"];
  const publishableKey = process.env["HYPERSWITCH_PUBLISHABLE_KEY"];
  const profileId = process.env["HYPERSWITCH_PROFILE_ID"];
  const environment = (process.env["HYPERSWITCH_ENVIRONMENT"] ?? "sandbox").toLowerCase();

  const missing = [
    apiKey ? null : "HYPERSWITCH_API_KEY",
    publishableKey ? null : "HYPERSWITCH_PUBLISHABLE_KEY",
    profileId ? null : "HYPERSWITCH_PROFILE_ID",
  ].filter(Boolean) as string[];
  if (missing.length) throw new PaymentsNotConfiguredError(missing);

  const isProd = environment === "production" || environment === "live";
  return {
    apiKey: apiKey!,
    publishableKey: publishableKey!,
    profileId: profileId!,
    webhookSecret: process.env["HYPERSWITCH_WEBHOOK_SECRET"] ?? null,
    environment: isProd ? "production" : "sandbox",
    baseUrl:
      process.env["HYPERSWITCH_BASE_URL"] ??
      (isProd ? "https://api.hyperswitch.io" : "https://sandbox.hyperswitch.io"),
  };
}

export async function hyperswitchRequest<T>(
  path: string,
  init: { method: "GET" | "POST"; body?: unknown } = { method: "GET" },
): Promise<T> {
  const config = hyperswitchConfig();
  const response = await fetch(`${config.baseUrl}${path}`, {
    method: init.method,
    headers: {
      "api-key": config.apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });

  const text = await response.text();
  if (!response.ok) {
    console.error("[hyperswitch]", init.method, path, response.status, text);
    throw new Error("The payment service could not complete this request. Please try again.");
  }
  return (text ? JSON.parse(text) : {}) as T;
}

/** HMAC verification of a Hyperswitch webhook payload (SHA-512 or SHA-256). */
export async function verifyWebhookSignature(
  rawBody: string,
  signature: string,
  secret: string,
  algorithm: "SHA-512" | "SHA-256",
): Promise<boolean> {
  if (!signature) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: algorithm },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const expected = Array.from(new Uint8Array(mac))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  const provided = signature.trim().toLowerCase();
  if (expected.length !== provided.length) return false;
  let mismatch = 0;
  for (let index = 0; index < expected.length; index += 1) {
    mismatch |= expected.charCodeAt(index) ^ provided.charCodeAt(index);
  }
  return mismatch === 0;
}
