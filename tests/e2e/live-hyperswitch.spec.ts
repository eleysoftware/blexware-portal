import { expect, test } from "@playwright/test";

test.describe("live Hyperswitch checkout", () => {
  test.skip(
    !process.env["HYPERSWITCH_API_KEY"],
    "Live Helcim checkout is optional; set HYPERSWITCH_API_KEY to enable.",
  );

  test("placeholder — run against sandbox only when keys are present", async () => {
    expect(process.env["HYPERSWITCH_API_KEY"]).toBeTruthy();
  });
});
