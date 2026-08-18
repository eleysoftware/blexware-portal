import { expect, test } from "@playwright/test";

import { MAX_FILES, validateAttachment } from "../../src/components/QuoteAttachments";

function pdf(name: string, size = 1024) {
  return new File([new Uint8Array(size)], name, { type: "application/pdf" });
}

test("accepts a PDF under the size limit", () => {
  expect(validateAttachment(pdf("brief.pdf"), [])).toBeNull();
});

test("rejects a non-PDF", () => {
  const file = new File([new Uint8Array(10)], "notes.txt", { type: "text/plain" });
  expect(validateAttachment(file, [])).toContain("isn't a PDF");
});

test("rejects an empty file", () => {
  expect(validateAttachment(pdf("empty.pdf", 0), [])).toContain("empty");
});

test("rejects a file over 20 MB", () => {
  expect(validateAttachment(pdf("huge.pdf", 20 * 1024 * 1024 + 1), [])).toContain("20 MB");
});

test("rejects a duplicate attachment", () => {
  const existing = [pdf("brief.pdf", 2048)];
  expect(validateAttachment(pdf("brief.pdf", 2048), existing)).toContain("already attached");
});

test("caps the wizard at three PDFs", () => {
  expect(MAX_FILES).toBe(3);
});
