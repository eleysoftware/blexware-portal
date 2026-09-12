import { describe, expect, it } from "vitest";

import { normaliseExtractedLineItems, normalisePhases } from "@/lib/import.functions";

describe("normaliseExtractedLineItems", () => {
  it("keeps well-formed priced rows and drops the rest", () => {
    const rows = normaliseExtractedLineItems([
      { label: " Phase 1 – Discovery ", amountCents: 120000, durationLabel: " 5 days " },
      { label: "No price" },
      { label: "", amountCents: 500 },
      { label: "Zero", amountCents: 0 },
      { label: "Phase 2", amountCents: "90000" },
    ]);

    expect(rows).toEqual([
      { label: "Phase 1 – Discovery", amountCents: 120000, durationLabel: "5 days" },
      { label: "Phase 2", amountCents: 90000 },
    ]);
  });

  it("returns an empty list when the model sends nothing usable", () => {
    expect(normaliseExtractedLineItems(undefined)).toEqual([]);
    expect(normaliseExtractedLineItems("nope")).toEqual([]);
  });
});

describe("normalisePhases", () => {
  it("uses the document's phase list when present", () => {
    expect(normalisePhases([" Discovery ", "Build", ""], [])).toEqual(["Discovery", "Build"]);
  });

  it("falls back to phase-like line items", () => {
    const items = [
      { label: "Phase 1 – Discovery", amountCents: 1 },
      { label: "Hosting", amountCents: 1 },
    ];
    expect(normalisePhases(undefined, items)).toEqual(["Phase 1 – Discovery"]);
  });
});
