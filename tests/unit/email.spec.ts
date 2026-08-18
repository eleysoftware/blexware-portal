import { expect, test } from "@playwright/test";

import { requireEmailSent, sendEmail } from "../../src/lib/email.server";

const mail = {
  subject: "Test",
  html: "<p>Hi</p>",
  text: "Hi",
};

test.describe.configure({ mode: "serial" });

test.describe("sendEmail", () => {
  const originalFetch = globalThis.fetch;
  const originalToken = process.env["ZEPTOMAIL_TOKEN"];
  const originalEndpoint = process.env["ZEPTOMAIL_ENDPOINT"];
  const originalBounce = process.env["ZEPTOMAIL_BOUNCE_ADDRESS"];

  test.afterEach(() => {
    globalThis.fetch = originalFetch;
    restoreEnv("ZEPTOMAIL_TOKEN", originalToken);
    restoreEnv("ZEPTOMAIL_ENDPOINT", originalEndpoint);
    restoreEnv("ZEPTOMAIL_BOUNCE_ADDRESS", originalBounce);
  });

  test("dry-runs @blexware.test without calling the provider", async () => {
    let called = false;
    globalThis.fetch = async () => {
      called = true;
      return new Response("should not run", { status: 500 });
    };
    delete process.env["ZEPTOMAIL_TOKEN"];

    const result = await sendEmail({
      to: "playwright+client@blexware.test",
      ...mail,
    });

    expect(result.sent).toBe(true);
    expect(called).toBe(false);
  });

  test("maps a ZeptoMail error body to a parsed reason", async () => {
    process.env["ZEPTOMAIL_TOKEN"] = "test-token";
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          error: { code: "SM_111", message: "Sender domain is not verified" },
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );

    const result = await sendEmail({
      to: "client@example.com",
      ...mail,
    });

    expect(result.sent).toBe(false);
    expect(result.reason).toBe("SM_111: Sender domain is not verified");
  });

  test("returns not_configured when the token is missing for a real address", async () => {
    delete process.env["ZEPTOMAIL_TOKEN"];
    let called = false;
    globalThis.fetch = async () => {
      called = true;
      return new Response("ok", { status: 200 });
    };

    const result = await sendEmail({
      to: "client@example.com",
      ...mail,
    });

    expect(result.sent).toBe(false);
    expect(result.reason).toBe("not_configured");
    expect(called).toBe(false);
  });
});

test("requireEmailSent throws the provider reason", () => {
  expect(() => requireEmailSent({ sent: false, reason: "SM_113: Invalid recipient" })).toThrow(
    "Could not email the client: SM_113: Invalid recipient",
  );
  expect(() => requireEmailSent({ sent: true })).not.toThrow();
});

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}
