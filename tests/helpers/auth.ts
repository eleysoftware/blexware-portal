import { expect, type Page } from "@playwright/test";

function signedInMarker(page: Page, dest: "/admin" | "/portal") {
  return dest === "/admin"
    ? page.getByRole("heading", { name: "Quote queue" })
    : page.getByRole("heading", { name: "Your projects" });
}

export async function expectToast(page: Page, pattern: RegExp, timeout = 30_000) {
  await expect(page.locator("[data-sonner-toast]").filter({ hasText: pattern })).toBeVisible({
    timeout,
  });
}

export async function signInAs(
  page: Page,
  input: { email: string; password: string; dest: "/admin" | "/portal" },
) {
  await page.goto("/auth");
  await expect(page.getByTestId("signin-email")).toBeVisible({ timeout: 20_000 });
  await page.getByTestId("signin-email").fill(input.email);
  await page.getByTestId("signin-password").fill(input.password);
  await expect(page.getByTestId("signin-email")).toHaveValue(input.email);
  await page.getByTestId("signin-submit").click();

  const ready = signedInMarker(page, input.dest);
  try {
    await expect(ready).toBeVisible({ timeout: 15_000 });
  } catch {
    const toast = page.locator("[data-sonner-toast]").first();
    if (await toast.isVisible()) {
      const text = (await toast.innerText()).trim();
      if (/invalid|error|confirm|breach|not configured/i.test(text)) {
        throw new Error(`Sign-in failed: ${text}`);
      }
    }
    await page.goto(input.dest);
    await expect(ready).toBeVisible({ timeout: 20_000 });
  }
}
