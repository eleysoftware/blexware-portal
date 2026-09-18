import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

import {
  attachmentsOf,
  mergeAttachments,
  normalizeAttachments,
  previewKindFor,
  removeAttachment,
  validateResourceFile,
} from "../../src/lib/resource-rules";
import {
  createResourceDeliveryToken,
  resourceDeliveryPath,
  safeAttachmentName,
  verifyResourceDeliveryToken,
} from "../../src/lib/resource-delivery";

const file = (path: string, name = path) => ({ path, name, mime: "application/pdf", size: 10 });

test("merges attachments without duplicating paths", () => {
  const merged = mergeAttachments([file("a"), file("b")], [file("c"), file("b", "b-renamed")]);
  expect(merged.map((attachment) => attachment.path)).toEqual(["a", "b", "c"]);
  expect(merged.find((attachment) => attachment.path === "b")?.name).toBe("b-renamed");
});

test("removes attachments by path", () => {
  const list = [file("a"), file("b")];
  expect(removeAttachment(list, "a").map((attachment) => attachment.path)).toEqual(["b"]);
  expect(removeAttachment(list, "missing")).toHaveLength(2);
});

test("normalizes stored jsonb and tolerates junk", () => {
  expect(normalizeAttachments(null)).toEqual([]);
  expect(normalizeAttachments("nope")).toEqual([]);
  expect(normalizeAttachments([{ path: "p", name: "f" }, { nope: true }, null])).toEqual([
    { path: "p", name: "f", mime: "application/octet-stream", size: 0 },
  ]);
});

test("falls back to the legacy single-file columns", () => {
  const legacy = {
    attachments: null,
    storage_path: "quote/legacy.pdf",
    original_name: "legacy.pdf",
    mime_type: "application/pdf",
    byte_size: 2048,
  };
  expect(attachmentsOf(legacy)).toEqual([
    { path: "quote/legacy.pdf", name: "legacy.pdf", mime: "application/pdf", size: 2048 },
  ]);
  expect(attachmentsOf({ ...legacy, storage_path: null })).toEqual([]);
  expect(attachmentsOf({ ...legacy, attachments: [file("new")] })).toEqual([file("new")]);
});

test("still validates every file individually", () => {
  expect(validateResourceFile({ name: "a.pdf", size: 10, type: "application/pdf" })).toBeNull();
  expect(validateResourceFile({ name: "a.pdf", size: 0, type: "application/pdf" })).toContain("empty");
  expect(
    validateResourceFile({ name: "big.pdf", size: 50 * 1024 * 1024 + 1, type: "application/pdf" }),
  ).toContain("50 MB");
  expect(validateResourceFile({ name: "a.exe", size: 10, type: "application/x-msdownload" })).toContain(
    "file type",
  );
});

test("accepts open-document formats", () => {
  expect(
    validateResourceFile({
      name: "notes.odt",
      size: 10,
      type: "application/vnd.oasis.opendocument.text",
    }),
  ).toBeNull();
  expect(validateResourceFile({ name: "sheet.ods", size: 10, type: "" })).toBeNull();
  expect(validateResourceFile({ name: "deck.odp", size: 10, type: "" })).toBeNull();
});

test("picks the right preview kind", () => {
  expect(previewKindFor("application/pdf", "a.pdf")).toBe("pdf");
  expect(previewKindFor("image/png", "a.png")).toBe("image");
  expect(previewKindFor("text/csv", "a.csv")).toBe("text");
  expect(previewKindFor("video/mp4", "a.mp4")).toBe("video");
  expect(previewKindFor("audio/mpeg", "a.mp3")).toBe("audio");
  expect(previewKindFor("application/vnd.oasis.opendocument.text", "a.odt")).toBe("none");
  expect(previewKindFor("", "a.pdf")).toBe("pdf");
  expect(previewKindFor("application/octet-stream", "a.jpg")).toBe("image");
  expect(previewKindFor("", "a.odt")).toBe("none");
});

test("signs and verifies exact short-lived file delivery claims", async () => {
  const claims = {
    resourceId: "resource-1",
    path: "quote/file.pdf",
    mode: "view" as const,
    expiresAt: 10_000,
  };
  const token = await createResourceDeliveryToken(claims, "test-secret");
  await expect(verifyResourceDeliveryToken(token, "test-secret", 9_999)).resolves.toEqual(claims);
  await expect(verifyResourceDeliveryToken(token, "wrong-secret", 9_999)).resolves.toBeNull();
  await expect(verifyResourceDeliveryToken(token, "test-secret", 10_000)).resolves.toBeNull();
  expect(resourceDeliveryPath(token)).toMatch(/^\/api\/resources\/file\?token=/);
});

test("rejects changed delivery tokens and sanitizes attachment names", async () => {
  const token = await createResourceDeliveryToken(
    { resourceId: "resource-1", path: "file.pdf", mode: "download", expiresAt: 10_000 },
    "test-secret",
  );
  const changed = `${token.slice(0, -1)}${token.endsWith("a") ? "b" : "a"}`;
  await expect(verifyResourceDeliveryToken(changed, "test-secret", 1)).resolves.toBeNull();
  expect(safeAttachmentName('../bad\r\n"name.pdf')).toBe(".._bad___name.pdf");
});

test("renders PDFs in the app instead of embedding a browser page", async () => {
  const source = await readFile("src/components/ResourcesPanel.tsx", "utf8");
  expect(source).toContain("<ResourcePdfPreview");
  expect(source).not.toContain("<iframe");
  expect(source).not.toContain("sandbox=");
});
