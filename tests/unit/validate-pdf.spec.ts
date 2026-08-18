import { expect, test } from "@playwright/test";

import { validatePdf } from "../../src/lib/blex.server";

function bytes(text: string) {
  return new TextEncoder().encode(text);
}

test("accepts a PDF header", () => {
  expect(validatePdf(bytes("%PDF-1.4\nplain content"), "ok.pdf")).toBeNull();
});

test("rejects a non-PDF", () => {
  expect(validatePdf(bytes("not a pdf"), "notes.pdf")).toContain("not a valid PDF");
});

test("rejects an encrypted PDF", () => {
  expect(validatePdf(bytes("%PDF-1.4\n/Encrypt"), "secret.pdf")).toContain("password-protected");
});

test("rejects JavaScript in a PDF", () => {
  expect(validatePdf(bytes("%PDF-1.4\n/JavaScript"), "script.pdf")).toContain("/JavaScript");
});

test("rejects a Launch action", () => {
  expect(validatePdf(bytes("%PDF-1.4\n/Launch"), "launch.pdf")).toContain("/Launch");
});
