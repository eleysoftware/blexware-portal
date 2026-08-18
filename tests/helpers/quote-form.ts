import { expect, type Page } from "@playwright/test";

const MINIMAL_PDF = Buffer.from("%PDF-1.1\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");

async function chooseRadio(page: Page, name: string, value: string) {
  const option = page.getByTestId(`quote-option-${name}-${value}`);
  await option.waitFor({ state: "visible" });
  // Dispatch on the control itself so overlays cannot swallow the pointer.
  await option.evaluate((card) => {
    const radio = card.querySelector<HTMLElement>('[role="radio"]');
    if (!radio) throw new Error("Radio control missing");
    radio.focus();
    radio.click();
  });
  await expect(page.getByTestId(`quote-radio-${name}-${value}`)).toHaveAttribute(
    "data-state",
    "checked",
  );
}

export async function fillQuoteWizard(
  page: Page,
  input: { email: string; name?: string; attachPdf?: boolean },
) {
  await page.goto("/free-quote", { waitUntil: "load" });
  const form = page.getByTestId("quote-form");
  await expect(form).toBeVisible();
  try {
    await expect(form).toHaveAttribute("data-hydrated", "true", { timeout: 20_000 });
  } catch {
    await page.reload({ waitUntil: "load" });
    await expect(form).toHaveAttribute("data-hydrated", "true", { timeout: 20_000 });
  }

  await chooseRadio(page, "projectType", "Web Application");
  await page.getByTestId("quote-continue").click();

  await page.locator("#industry").selectOption("Business Consultants");
  await page.getByTestId("quote-continue").click();

  await page.getByTestId("quote-service-Web Applications").click();
  await page.getByTestId("quote-continue").click();

  await page
    .locator("#goals")
    .fill("We need a client portal that tracks quotes, proposals, and invoice payments.");
  await page.getByTestId("quote-continue").click();

  await page.locator("#features").fill("Auth, admin queue, and invoice checkout.");
  if (input.attachPdf) {
    await page.getByTestId("quote-attachments").setInputFiles({
      name: "brief.pdf",
      mimeType: "application/pdf",
      buffer: MINIMAL_PDF,
    });
  }
  await page.getByTestId("quote-continue").click();

  await chooseRadio(page, "budget", "$5,000 - $10,000");
  await page.getByTestId("quote-continue").click();

  await chooseRadio(page, "timeline", "1-3 months");
  await page.getByTestId("quote-continue").click();

  await page.locator("#name").fill(input.name ?? "Playwright Client");
  await page.locator("#email").fill(input.email);
  await page.locator("#company").fill("Playwright Test Co");
  await page.getByTestId("quote-consent").click();
  await page.getByTestId("quote-submit").click();
}

export { MINIMAL_PDF };
