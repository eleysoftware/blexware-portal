import { expect, test } from "@playwright/test";

import { moveItem, nudgeItem } from "@/lib/reorder";

test("moveItem moves an item to a new index", () => {
  expect(moveItem(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
  expect(moveItem(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
});

test("moveItem clamps out-of-range targets and ignores no-ops", () => {
  expect(moveItem(["a", "b"], 0, 9)).toEqual(["b", "a"]);
  expect(moveItem(["a", "b"], 1, -4)).toEqual(["b", "a"]);
  expect(moveItem(["a", "b"], 0, 0)).toEqual(["a", "b"]);
  expect(moveItem(["a", "b"], 5, 0)).toEqual(["a", "b"]);
});

test("nudgeItem shifts one step and stops at the ends", () => {
  expect(nudgeItem(["a", "b", "c"], 1, -1)).toEqual(["b", "a", "c"]);
  expect(nudgeItem(["a", "b", "c"], 1, 1)).toEqual(["a", "c", "b"]);
  expect(nudgeItem(["a", "b", "c"], 0, -1)).toEqual(["a", "b", "c"]);
  expect(nudgeItem(["a", "b", "c"], 2, 1)).toEqual(["a", "b", "c"]);
});
