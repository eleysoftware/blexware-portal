import { expect, test } from "@playwright/test";

import {
  attachmentsOf,
  mergeAttachments,
  normalizeAttachments,
  removeAttachment,
  validateResourceFile,
} from "../../src/lib/resource-rules";

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
