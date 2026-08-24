import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const read = (path: string) => readFileSync(path, "utf8");

test("client response actions cannot load document rendering", () => {
  const responseFunctions = read("src/lib/client-engagement.functions.ts");
  const emailHelpers = read("src/lib/engagement-email.server.ts");

  expect(responseFunctions).not.toContain("engagement.server");
  expect(responseFunctions).not.toContain("documents/render.server");
  expect(responseFunctions).not.toContain('from "pdf-lib"');
  expect(emailHelpers).not.toContain("document-storage.server");
  expect(emailHelpers).not.toContain("documents/render.server");
  expect(emailHelpers).not.toContain('from "pdf-lib"');
  expect(emailHelpers).not.toContain('from "docx"');
});

test("PDF and DOCX dependencies stay behind the document-storage boundary", () => {
  const storage = read("src/lib/document-storage.server.ts");
  expect(storage).toContain('await import("@/lib/documents/render.server")');
});