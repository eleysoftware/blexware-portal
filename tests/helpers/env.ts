export function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}. Add it to .env before running this test.`);
  return value;
}

export function webhookSecret(): string {
  return process.env["HYPERSWITCH_WEBHOOK_SECRET"] ?? "playwright-test-webhook-secret";
}

export function adminCredentials(): { email: string; password: string } {
  return {
    email: process.env["TEST_ADMIN_EMAIL"] ?? "playwright+admin@blexware.test",
    password: process.env["TEST_ADMIN_PASSWORD"] ?? "Playwright-Admin1!",
  };
}

export function testEmail(runId: string, suffix = "client"): string {
  return `playwright+${suffix}.${runId}@blexware.test`;
}

export const TEST_CLIENT_PASSWORD = "Playwright-Quote1!";
