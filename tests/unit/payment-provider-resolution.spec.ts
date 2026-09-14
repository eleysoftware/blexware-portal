import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

/**
 * The admin setting stored in the database is the single source of truth for
 * which processor runs and in which mode. Environment variables are only a
 * default for a fresh install.
 */

const settings = vi.hoisted(() => ({
  value: { provider: "paypal" as "paypal" | "hyperswitch", environment: "sandbox" as "sandbox" | "live" },
}));

vi.mock("@/lib/settings.server", () => ({
  getPaymentProviderSettings: vi.fn(async () => settings.value),
}));

describe("active payment provider", () => {
  beforeEach(() => {
    // Legacy env values that used to win over the admin setting.
    process.env["PAYMENTS_PROVIDER"] = "hyperswitch";
    process.env["HYPERSWITCH_ENVIRONMENT"] = "sandbox";
    process.env["PAYPAL_SANDBOX_CLIENT_ID"] = "sandbox-client";
    process.env["PAYPAL_SANDBOX_SECRET"] = "sandbox-secret";
    delete process.env["PAYPAL_LIVE_CLIENT_ID"];
    delete process.env["PAYPAL_LIVE_SECRET"];
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("uses the saved provider even when the env default says otherwise", async () => {
    settings.value = { provider: "paypal", environment: "sandbox" };
    const { getActiveProviderName, envDefaultProvider } = await import("@/lib/payments/service.server");
    expect(envDefaultProvider()).toBe("hyperswitch");
    expect(await getActiveProviderName()).toBe("paypal");
  });

  it("uses the saved mode even when the env default says otherwise", async () => {
    settings.value = { provider: "paypal", environment: "live" };
    const { getActiveEnvironment } = await import("@/lib/payments/service.server");
    expect(await getActiveEnvironment()).toBe("live");
  });

  it("builds the provider for the saved mode", async () => {
    const { providerFor } = await import("@/lib/payments/service.server");
    const sandbox = providerFor("paypal", "sandbox");
    const live = providerFor("paypal", "live");
    expect(sandbox.name).toBe("paypal");
    expect(sandbox.isConfigured()).toBe(true);
    // Live keys are absent in this test environment.
    expect(live.isConfigured()).toBe(false);
  });

  it("reports credentials per provider and mode", async () => {
    const { providerHasCredentials } = await import("@/lib/payments/service.server");
    expect(providerHasCredentials("paypal", "sandbox")).toBe(true);
    expect(providerHasCredentials("paypal", "live")).toBe(false);
  });
});
