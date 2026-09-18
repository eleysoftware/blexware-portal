import { expect, test } from "@playwright/test";

import {
  canEditResource,
  validateResourceDetails,
  validateResourceFile,
} from "../../src/lib/resource-rules";

test("requires a title", () => {
  expect(validateResourceDetails({ title: "  " })).toContain("title");
});

test("caps the description at 250 characters", () => {
  expect(validateResourceDetails({ title: "Brief", description: "x".repeat(251) })).toContain("250");
  expect(validateResourceDetails({ title: "Brief", description: "x".repeat(250) })).toBeNull();
});

test("accepts a spreadsheet, image and video", () => {
  for (const file of [
    { name: "budget.xlsx", size: 2048, type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
    { name: "logo.png", size: 2048, type: "image/png" },
    { name: "walkthrough.mp4", size: 2048, type: "video/mp4" },
  ]) {
    expect(validateResourceFile(file)).toBeNull();
  }
});

test("rejects a file over 50 MB", () => {
  expect(
    validateResourceFile({ name: "big.mp4", size: 50 * 1024 * 1024 + 1, type: "video/mp4" }),
  ).toContain("50 MB");
});

test("rejects an executable", () => {
  expect(validateResourceFile({ name: "setup.exe", size: 10, type: "application/x-msdownload" })).toContain(
    "file type",
  );
});

test("only the author or an admin can edit", () => {
  const resource = { author_id: "user-1" };
  expect(canEditResource(resource, { userId: "user-1", isAdmin: false })).toBe(true);
  expect(canEditResource(resource, { userId: "user-2", isAdmin: false })).toBe(false);
  expect(canEditResource(resource, { userId: "user-2", isAdmin: true })).toBe(true);
});
