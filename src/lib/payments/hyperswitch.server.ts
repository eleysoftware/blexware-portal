// Thin REST client for Hyperswitch Cloud. Server-only: the API key never
// leaves this module. No processor (Helcim, Stripe, …) is referenced here —
// connectors are configured inside the Hyperswitch dashboard.

import {
  hyperswitchApiKey,
  hyperswitchApiUrl,
  hyperswitchProfileId,
  hyperswitchPublishableKey,
  hyperswitchWebhookSecret,
  isPaymentsConfigured as configuredInEnv,
  paymentEnvironment,
} from "@/config/payments";

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
  return configuredInEnv();
}

export function hyperswitchConfig(): HyperswitchConfig {
  if (!isPaymentsConfigured()) {
    const missing = [
      hyperswitchPublishableKey() ? null : "HYPERSWITCH_PUBLISHABLE_KEY",
      hyperswitchProfileId() ? null : "HYPERSWITCH_PROFILE_ID",
    ].filter(Boolean) as string[];
    try {
      hyperswitchApiKey();
    } catch {
      missing.unshift("HYPERSWITCH_API_KEY");
    }
    throw new PaymentsNotConfiguredError(missing);
  }

  return {
    apiKey: hyperswitchApiKey(),
    publishableKey: hyperswitchPublishableKey()!,
    profileId: hyperswitchProfileId()!,
    webhookSecret: hyperswitchWebhookSecret() ?? null,
    environment: paymentEnvironment(),
    baseUrl: hyperswitchApiUrl(),
  };
}

/**
 * A non-2xx response from Hyperswitch. `message` stays generic (it may reach a
 * toast); callers inspect `code` to handle a specific gateway condition.
 */
export class HyperswitchApiError extends Error {
  readonly status: number;
  readonly code: string | null;
  readonly providerMessage: string | null;
  constructor(status: number, code: string | null, providerMessage: string | null) {
    super("The payment service could not complete this request. Please try again.");
    this.name = "HyperswitchApiError";
    this.status = status;
    this.code = code;
    this.providerMessage = providerMessage;
  }
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
    let code: string | null = null;
    let providerMessage: string | null = null;
    try {
      const parsed = JSON.parse(text) as {
        error?: { code?: string; message?: string };
        error_code?: string;
        error_message?: string;
      };
      code = parsed.error?.code ?? parsed.error_code ?? null;
      providerMessage = parsed.error?.message ?? parsed.error_message ?? null;
    } catch {
      /* non-JSON error body */
    }
    throw new HyperswitchApiError(response.status, code, providerMessage);
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
