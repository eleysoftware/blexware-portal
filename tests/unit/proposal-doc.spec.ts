import { expect, test } from "@playwright/test";

import {
  hasStructuredProposalDoc,
  isImportedProposal,
  shouldRebuildProposalDoc,
} from "../../src/lib/documents/proposal";
import type { ProjectDocument } from "../../src/lib/documents/types";

const structured: ProjectDocument = {
  kind: "proposal",
  title: "CLIENT",
  clientName: "Client",
  date: "August 2026",
  preparedFor: { name: "Client" },
  preparedBy: { name: "BLEXware" },
  sections: [{ heading: "Overview", body: ["Hello"] }],
};

test("treats manual/imported as the BFW import model", () => {
  expect(isImportedProposal("manual/imported")).toBe(true);
  expect(isImportedProposal("google/gemini-2.5-flash")).toBe(false);
});

test("requires at least one section for structured JSON", () => {
  expect(hasStructuredProposalDoc(structured)).toBe(true);
  expect(hasStructuredProposalDoc(null)).toBe(false);
  expect(hasStructuredProposalDoc({ kind: "proposal", sections: [] })).toBe(false);
});

test("does not rebuild imported structured docs", () => {
  expect(shouldRebuildProposalDoc("manual/imported", structured)).toBe(false);
});

test("rebuilds portal markdown proposals even if a stub doc exists", () => {
  expect(shouldRebuildProposalDoc("google/gemini-2.5-flash", null)).toBe(true);
  expect(shouldRebuildProposalDoc("google/gemini-2.5-flash", structured)).toBe(true);
});

test("rebuilds imported rows that never received sections", () => {
  expect(shouldRebuildProposalDoc("manual/imported", null)).toBe(true);
});
