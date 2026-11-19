import { describe, expect, it } from "vitest";
import { sowRevisions } from "@/lib/sow-revisions";

const ag = [{ id: "a1", agreement_number: "SOW-2026-0045", status: "draft" }];
const doc = (id: string, format: string, at: string) => ({ id, entity: "agreement", entity_id: "a1", format, created_at: at });

describe("sowRevisions", () => {
  it("adds one revision row per regenerate, newest first", () => {
    const rows = sowRevisions(
      [
        doc("p1", "pdf", "2026-11-17T22:46:50.187Z"),
        doc("d1", "docx", "2026-11-17T22:46:50.344Z"),
        doc("p2", "pdf", "2026-11-19T15:14:16.160Z"),
        doc("d2", "docx", "2026-11-19T15:14:16.560Z"),
      ],
      ag,
    );
    expect(rows.map((r) => r.revision)).toEqual([2, 1]);
    expect(rows[0]).toMatchObject({ pdfId: "p2", docxId: "d2", latest: true });
    expect(rows[1].latest).toBe(false);
  });
});
