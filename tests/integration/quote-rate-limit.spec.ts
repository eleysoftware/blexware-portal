import { expect, test } from "@playwright/test";

import { cleanupByEmail, insertQuote, newRunId, playwrightEmail } from "../helpers/db";
import { fillQuoteWizard } from "../helpers/quote-form";

test("rejects a sixth quote from the same email within an hour", async ({ page }) => {
  const email = playwrightEmail(newRunId(), "ratelimit");
  try {
    for (let index = 0; index < 5; index += 1) {
      await insertQuote(email);
    }
    await fillQuoteWizard(page, { email });
    await expect(page.getByText(/several recent requests/i)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("quote-number")).toHaveCount(0);
  } finally {
    await cleanupByEmail(email);
  }
});
