import { expect, test } from "@playwright/test";

import { evenSplitRows, SPLIT_COUNTS } from "@/lib/documents/compose";

test("every supported split adds back up to the total", () => {
  for (const count of SPLIT_COUNTS) {
    const rows = evenSplitRows(523_37, count);
    expect(rows).toHaveLength(count);
    expect(rows.reduce((sum, row) => sum + row.amountCents, 0)).toBe(523_37);
  }
});

test("rounding drift lands on the first invoice", () => {
  const rows = evenSplitRows(1000, 3);
  expect(rows.map((row) => row.amountCents)).toEqual([334, 333, 333]);
});

test("a single invoice is labelled for signature", () => {
  expect(evenSplitRows(50_000, 1)).toEqual([{ label: "Due upon signature", amountCents: 50_000 }]);
});
