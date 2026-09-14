import { expect, test } from "@playwright/test";

import type { ProjectDocument } from "@/lib/documents/types";

/**
 * Mirrors the acceptance-block update that `recordAgreementSignature` writes,
 * so the rendered wording stays honest about who signed.
 */
function applyRecordedSignature(
  doc: ProjectDocument,
  input: { mode: "recorded" | "waived"; signerName?: string; signedLabel: string; channel: string },
): ProjectDocument {
  const waived = input.mode === "waived";
  const signerName = waived ? "Signature waived by BLEXware" : (input.signerName ?? "");
  return {
    ...doc,
    acceptance: {
      ...(doc.acceptance ?? {}),
      signerName,
      ...(waived ? {} : { signatureText: signerName }),
      signedAt: input.signedLabel,
      signatureNote: waived
        ? `Signature waived by BLEXware on ${input.signedLabel}. Work and billing proceed under the terms above.`
        : `Signature recorded by BLEXware staff — received ${input.channel} on ${input.signedLabel}.`,
    },
  };
}

const base: ProjectDocument = {
  kind: "sow",
  title: "Statement of Work",
  clientName: "Tamara West",
  date: "September 14, 2026",
  preparedFor: { name: "Tamara West" },
  preparedBy: { name: "Kamal Eley" },
  sections: [],
  acceptance: { intro: ["Accepting this SOW authorises the work described above."] },
};

test("a recorded signature keeps the signer name and says it came from staff", () => {
  const doc = applyRecordedSignature(base, {
    mode: "recorded",
    signerName: "Tamara West",
    signedLabel: "September 14, 2026",
    channel: "on paper",
  });
  expect(doc.acceptance?.signerName).toBe("Tamara West");
  expect(doc.acceptance?.signatureText).toBe("Tamara West");
  expect(doc.acceptance?.signatureNote).toContain("recorded by BLEXware staff");
  expect(doc.acceptance?.signatureNote).toContain("on paper");
});

test("a waived signature carries no client signature text", () => {
  const doc = applyRecordedSignature(base, {
    mode: "waived",
    signedLabel: "September 14, 2026",
    channel: "outside the portal",
  });
  expect(doc.acceptance?.signatureText).toBeUndefined();
  expect(doc.acceptance?.signerName).toBe("Signature waived by BLEXware");
  expect(doc.acceptance?.signatureNote).toContain("waived");
});

test("the original acceptance intro survives", () => {
  const doc = applyRecordedSignature(base, {
    mode: "recorded",
    signerName: "Tamara West",
    signedLabel: "September 14, 2026",
    channel: "by email",
  });
  expect(doc.acceptance?.intro?.[0]).toContain("authorises the work");
});
