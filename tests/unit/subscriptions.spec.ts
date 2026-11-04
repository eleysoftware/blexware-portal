import { expect, test } from "@playwright/test";

import { addYears, coerceSubscriptionSettings, noticeDateFor } from "../../src/lib/subscription-dates";

test("hosting defaults to $120 per year with a 14-day notice", () => {
  const s = coerceSubscriptionSettings(null);
  expect(s.amountCents).toBe(12000);
  expect(s.noticeDays).toBe(14);
});

test("renewal is one year after start", () => {
  expect(addYears("2026-11-04", 1)).toBe("2027-11-04");
  expect(addYears("2028-02-29", 1)).toBe("2029-02-28");
});

test("advance notice goes out two weeks before renewal", () => {
  expect(noticeDateFor("2027-11-04", 14)).toBe("2027-10-21");
});
