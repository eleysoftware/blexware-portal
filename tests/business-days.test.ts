import { describe, expect, it } from "vitest";

import { addBusinessDays, isBusinessDayDue } from "@/lib/business-days";

describe("invoice reminder business days", () => {
  it("skips weekends", () => {
    expect(addBusinessDays("2026-09-25T12:00:00Z", 3).toISOString().slice(0, 10)).toBe("2026-09-30");
  });

  it("becomes due exactly three weekdays later", () => {
    expect(isBusinessDayDue("2026-09-25T12:00:00Z", 3, new Date("2026-09-30T12:00:00Z"))).toBe(true);
    expect(isBusinessDayDue("2026-09-25T12:00:00Z", 3, new Date("2026-09-29T12:00:00Z"))).toBe(false);
  });
});