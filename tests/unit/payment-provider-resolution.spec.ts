import { expect, test } from "@playwright/test";

/**
 * The admin setting stored in the database is the single source of truth for
 * which processor runs and in which mode. Environment variables are only a
 * default for a fresh install, and credentials follow the selected mode.
 */

test("env values are only a default, and the plural name is honoured", async () => {
  process.env["PAYMENTS_PROVIDER"] = "hyperswitch";
  delete process.env["PAYMENT_PROVIDER"];
  const { envDefaultProvider, envDefaultEnvironment } = await import("@/lib/payments/service.server");
  expect(envDefaultProvider()).toBe("hyperswitch");
  expect(envDefaultEnvironment()).toBe("sandbox");
});

test("provider is built for the selected mode", async () => {
  process.env["PAYPAL_SANDBOX_CLIENT_ID"] = "sandbox-client";
  process.env["PAYPAL_SANDBOX_CLIENT_SECRET"] = "sandbox-secret";
  delete process.env["PAYPAL_LIVE_CLIENT_ID"];
  delete process.env["PAYPAL_LIVE_SECRET"];
  delete process.env["PAYPAL_LIVE_CLIENT_SECRET"];

  const { providerFor, providerHasCredentials } = await import("@/lib/payments/service.server");

  const sandbox = providerFor("paypal", "sandbox");
  expect(sandbox.name).toBe("paypal");
  expect(sandbox.isConfigured()).toBe(true);

  const live = providerFor("paypal", "live");
  expect(live.name).toBe("paypal");
  expect(live.isConfigured()).toBe(false);

  expect(providerHasCredentials("paypal", "sandbox")).toBe(true);
  expect(providerHasCredentials("paypal", "live")).toBe(false);
});

test("paypal checkout config carries the selected mode", async () => {
  process.env["PAYPAL_SANDBOX_CLIENT_ID"] = "sandbox-client";
  process.env["PAYPAL_SANDBOX_CLIENT_SECRET"] = "sandbox-secret";
  const { createPaypalProvider } = await import("@/lib/payments/paypal.provider.server");
  const config = createPaypalProvider("sandbox").publicConfig();
  expect(config.provider).toBe("paypal");
  expect(config.checkout).toMatchObject({ kind: "paypal", environment: "sandbox", clientId: "sandbox-client" });
});

test("both secret naming forms are accepted", async () => {
  process.env["PAYPAL_SANDBOX_CLIENT_ID"] = "sandbox-client";
  delete process.env["PAYPAL_SANDBOX_CLIENT_SECRET"];
  process.env["PAYPAL_SANDBOX_SECRET"] = "legacy-secret";
  const { providerHasCredentials } = await import("@/lib/payments/service.server");
  expect(providerHasCredentials("paypal", "sandbox")).toBe(true);

  delete process.env["PAYPAL_SANDBOX_SECRET"];
  process.env["PAYPAL_SANDBOX_CLIENT_SECRET"] = "dashboard-secret";
  expect(providerHasCredentials("paypal", "sandbox")).toBe(true);
});
