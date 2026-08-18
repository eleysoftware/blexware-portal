import { existsSync, readFileSync } from "node:fs";
import { defineConfig } from "@playwright/test";

// Env used by integration + e2e (gitignored `.env`; comments there mirror this list):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//   HYPERSWITCH_WEBHOOK_SECRET — a test HMAC secret is enough if sandbox is not live
//   TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD — optional; setup creates playwright+admin@blexware.test

function loadDotEnv(path: string) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadDotEnv(".env");

const argv = process.argv.join(" ");
const unitOnly = argv.includes("--project=unit") || /--project\s+unit(?:\s|$)/.test(argv);
const port = Number(process.env["PLAYWRIGHT_PORT"] ?? 8080);
const baseURL = process.env["PLAYWRIGHT_BASE_URL"] ?? `http://localhost:${port}`;

export default defineConfig({
  fullyParallel: true,
  forbidOnly: !!process.env["CI"],
  retries: process.env["CI"] ? 1 : 0,
  reporter: process.env["CI"] ? "github" : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  webServer: unitOnly
    ? undefined
    : {
        command: `npx vite --port ${port} --host localhost --strictPort`,
        url: baseURL,
        reuseExistingServer: !process.env["CI"],
        timeout: 180_000,
        stdout: "pipe",
        env: {
          ...process.env,
          HYPERSWITCH_WEBHOOK_SECRET:
            process.env["HYPERSWITCH_WEBHOOK_SECRET"] ?? "playwright-test-webhook-secret",
        },
      },
  projects: [
    { name: "unit", testDir: "./tests/unit" },
    {
      name: "integration",
      testDir: "./tests/integration",
      timeout: 60_000,
      retries: 1,
      use: { browserName: "chromium" },
    },
    {
      name: "setup",
      testDir: "./tests/e2e",
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: "e2e",
      testDir: "./tests/e2e",
      testIgnore: /auth\.setup\.ts|live-hyperswitch\.spec\.ts/,
      dependencies: ["setup"],
      timeout: 300_000,
      retries: 1,
      use: { browserName: "chromium" },
    },
  ],
});
